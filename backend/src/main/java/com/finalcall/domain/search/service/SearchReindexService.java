package com.finalcall.domain.search.service;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicReference;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.SearchErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Ulid;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/** 관리자 온디맨드 검색 재색인 job 오케스트레이터. */
@Slf4j
@Service
public class SearchReindexService {

    private final ListingIndexer listingIndexer;
    private final SearchIndexManager searchIndexManager;
    private final SearchReindexGuard searchReindexGuard;
    private final AtomicReference<SearchReindexJob> currentJob = new AtomicReference<>();
    private final ExecutorService executor;

    @Autowired
    public SearchReindexService(ListingIndexer listingIndexer, SearchIndexManager searchIndexManager,
        SearchReindexGuard searchReindexGuard) {
        this(listingIndexer, searchIndexManager, searchReindexGuard, Executors.newSingleThreadExecutor(
            Thread.ofPlatform().name("search-reindex-").factory()));
    }

    SearchReindexService(ListingIndexer listingIndexer, SearchIndexManager searchIndexManager,
        SearchReindexGuard searchReindexGuard, ExecutorService executor) {
        this.listingIndexer = listingIndexer;
        this.searchIndexManager = searchIndexManager;
        this.searchReindexGuard = searchReindexGuard;
        this.executor = executor;
    }

    @ServiceLog
    public SearchReindexJob start(SearchReindexMode mode) {
        if (!searchReindexGuard.tryAcquire()) {
            throw new BusinessException(SearchErrorCode.SEARCH_REINDEX_IN_PROGRESS);
        }
        SearchReindexJob pending = SearchReindexJob.pending(Ulid.generate(), mode);
        while (true) {
            SearchReindexJob current = currentJob.get();
            if (current != null && current.active()) {
                searchReindexGuard.release();
                throw new BusinessException(SearchErrorCode.SEARCH_REINDEX_IN_PROGRESS);
            }
            if (currentJob.compareAndSet(current, pending)) {
                try {
                    executor.execute(() -> execute(pending));
                    return pending;
                } catch (RuntimeException ex) {
                    currentJob.compareAndSet(pending, null);
                    searchReindexGuard.release();
                    throw ex;
                }
            }
        }
    }

    public SearchReindexJob get(String jobId) {
        SearchReindexJob job = currentJob.get();
        if (job == null || !job.jobId().equals(jobId)) {
            throw new BusinessException(SearchErrorCode.SEARCH_REINDEX_JOB_NOT_FOUND);
        }
        return job;
    }

    private void execute(SearchReindexJob pending) {
        String failureSummary = "검색 재색인 처리 중 오류가 발생했습니다.";
        try {
            if (pending.mode() == SearchReindexMode.IN_PLACE) {
                failureSummary = "현재 검색 인덱스 백필에 실패했습니다.";
                update(pending.running(null));
                int indexed = listingIndexer.reindexAll();
                update(currentJob.get().succeeded(indexed, false));
                return;
            }
            failureSummary = "신규 검색 인덱스 생성 또는 스키마 검증에 실패했습니다.";
            String target = searchIndexManager.createNextIndex();
            update(pending.running(target));
            SearchIndexCounts expected = listingIndexer.sourceCounts();
            failureSummary = "신규 검색 인덱스 백필에 실패했습니다.";
            int indexed = listingIndexer.reindexAll(target);
            failureSummary = "신규 검색 인덱스 데이터 검증에 실패했습니다.";
            searchIndexManager.verifyCounts(target, expected);
            failureSummary = "검색 인덱스 전환에 실패했습니다.";
            searchIndexManager.switchAlias(target);
            update(currentJob.get().aliasSwitched(indexed));
            failureSummary = "검색 인덱스 전환 후 동기화에 실패했습니다.";
            listingIndexer.reindexAll();
            update(currentJob.get().succeeded(indexed, true));
        } catch (RuntimeException ex) {
            SearchReindexJob current = currentJob.get();
            update(current.failed(failureSummary));
            log.error("검색 재색인 실패 jobId={} mode={}", pending.jobId(), pending.mode(), ex);
        } finally {
            searchReindexGuard.release();
        }
    }

    private void update(SearchReindexJob job) {
        currentJob.set(job);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}
