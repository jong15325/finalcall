package com.finalcall.domain.search.service;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.UnaryOperator;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Ulid;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/** 관리자 온디맨드 검색 재색인 job 오케스트레이터. */
@Slf4j
@Service
@Transactional(readOnly = true)
public class SearchReindexService {

    private static final long SHUTDOWN_WAIT_SECONDS = 1L;

    private final ListingIndexer listingIndexer;
    private final SearchIndexManager searchIndexManager;
    private final SearchReindexGuard searchReindexGuard;
    private final AtomicReference<SearchReindexJob> currentJob = new AtomicReference<>();
    private final AtomicReference<FutureTask<Void>> currentTask = new AtomicReference<>();
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
            throw new IllegalStateException("검색 재색인이 이미 진행 중입니다.");
        }
        SearchReindexJob pending = SearchReindexJob.pending(Ulid.generate(), mode);
        while (true) {
            SearchReindexJob current = currentJob.get();
            if (current != null && current.active()) {
                searchReindexGuard.release();
                throw new IllegalStateException("검색 재색인이 이미 진행 중입니다.");
            }
            if (currentJob.compareAndSet(current, pending)) {
                FutureTask<Void> task = new FutureTask<>(() -> {
                    execute(pending);
                    return null;
                });
                currentTask.set(task);
                try {
                    executor.execute(task);
                    return pending;
                } catch (RuntimeException ex) {
                    currentTask.compareAndSet(task, null);
                    currentJob.compareAndSet(pending, null);
                    searchReindexGuard.release();
                    throw ex;
                }
            }
        }
    }

    @ServiceLog
    public SearchReindexJob get(String jobId) {
        SearchReindexJob job = currentJob.get();
        if (job == null || !job.jobId().equals(jobId)) {
            throw new IllegalArgumentException("검색 재색인 작업을 찾을 수 없습니다.");
        }
        return job;
    }

    private void execute(SearchReindexJob pending) {
        String failureSummary = "검색 재색인 처리 중 오류가 발생했습니다.";
        try {
            if (pending.mode() == SearchReindexMode.IN_PLACE) {
                failureSummary = "현재 검색 인덱스 백필에 실패했습니다.";
                updateActive(pending.jobId(), job -> job.running(null));
                int indexed = listingIndexer.reindexAll();
                updateActive(pending.jobId(), job -> job.succeeded(indexed, false));
                return;
            }
            failureSummary = "신규 검색 인덱스 생성 또는 스키마 검증에 실패했습니다.";
            String target = searchIndexManager.createNextIndex();
            updateActive(pending.jobId(), job -> job.running(target));
            SearchIndexCounts expected = listingIndexer.sourceCounts();
            failureSummary = "신규 검색 인덱스 백필에 실패했습니다.";
            int indexed = listingIndexer.reindexAll(target);
            failureSummary = "신규 검색 인덱스 데이터 검증에 실패했습니다.";
            searchIndexManager.verifyCounts(target, expected);
            failureSummary = "검색 인덱스 전환에 실패했습니다.";
            searchIndexManager.switchAlias(target);
            updateActive(pending.jobId(), job -> job.aliasSwitched(indexed));
            failureSummary = "검색 인덱스 전환 후 동기화에 실패했습니다.";
            listingIndexer.reindexAll();
            updateActive(pending.jobId(), job -> job.succeeded(indexed, true));
        } catch (RuntimeException ex) {
            String summary = failureSummary;
            updateActive(pending.jobId(), job -> job.failed(summary));
            log.error("검색 재색인 실패 jobId={} mode={}", pending.jobId(), pending.mode(), ex);
        } finally {
            searchReindexGuard.release();
            FutureTask<Void> task = currentTask.get();
            if (task != null && task.isDone()) {
                currentTask.compareAndSet(task, null);
            }
        }
    }

    private void updateActive(String jobId, UnaryOperator<SearchReindexJob> transition) {
        while (true) {
            SearchReindexJob current = currentJob.get();
            if (current == null || !current.jobId().equals(jobId) || !current.active()) {
                return;
            }
            if (currentJob.compareAndSet(current, transition.apply(current))) {
                return;
            }
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(SHUTDOWN_WAIT_SECONDS, java.util.concurrent.TimeUnit.SECONDS)) {
                forceShutdown();
            }
        } catch (InterruptedException ex) {
            forceShutdown();
            Thread.currentThread().interrupt();
        }
    }

    private void forceShutdown() {
        java.util.List<Runnable> queued = executor.shutdownNow();
        FutureTask<Void> task = currentTask.get();
        boolean neverStarted = task != null && queued.contains(task);
        failActiveJobOnShutdown();
        if (neverStarted) {
            currentTask.compareAndSet(task, null);
            searchReindexGuard.release();
        }
    }

    private void failActiveJobOnShutdown() {
        currentJob.updateAndGet(job -> job != null && job.active()
            ? job.failed("애플리케이션 종료로 검색 재색인이 중단되었습니다.")
            : job);
    }
}
