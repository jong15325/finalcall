package com.finalcall.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.SearchErrorCode;

class SearchReindexServiceTest {

    private final ListingIndexer listingIndexer = mock(ListingIndexer.class);
    private final SearchIndexManager searchIndexManager = mock(SearchIndexManager.class);
    private final SearchReindexGuard searchReindexGuard = new SearchReindexGuard();
    private final SearchReindexService service = new SearchReindexService(listingIndexer, searchIndexManager,
        searchReindexGuard);

    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    @Test
    void 실행중_재요청은_409이고_완료되면_상태를_조회한다() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(listingIndexer.reindexAll()).thenAnswer(invocation -> {
            entered.countDown();
            release.await(3, TimeUnit.SECONDS);
            return 7;
        });

        SearchReindexJob accepted = service.start(SearchReindexMode.IN_PLACE);
        assertThat(entered.await(3, TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> service.start(SearchReindexMode.IN_PLACE))
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode()).isEqualTo(SearchErrorCode.SEARCH_REINDEX_IN_PROGRESS));

        release.countDown();
        SearchReindexJob completed = awaitTerminal(accepted.jobId());
        assertThat(completed.state()).isEqualTo(SearchReindexState.SUCCEEDED);
        assertThat(completed.indexedCount()).isEqualTo(7);
    }

    @Test
    void 존재하지_않는_job은_404다() {
        assertThatThrownBy(() -> service.get("missing"))
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode()).isEqualTo(SearchErrorCode.SEARCH_REINDEX_JOB_NOT_FOUND));
    }

    @Test
    void 화해가_permit을_점유하면_관리자_job은_409다() {
        assertThat(searchReindexGuard.tryAcquire()).isTrue();
        try {
            assertThatThrownBy(() -> service.start(SearchReindexMode.IN_PLACE))
                .isInstanceOfSatisfying(BusinessException.class,
                    ex -> assertThat(ex.getErrorCode()).isEqualTo(SearchErrorCode.SEARCH_REINDEX_IN_PROGRESS));
        } finally {
            searchReindexGuard.release();
        }
    }

    @Test
    void executor_제출_실패는_pending과_permit을_복구해_후속_요청을_허용한다() {
        ExecutorService executor = mock(ExecutorService.class);
        doThrow(new RejectedExecutionException("sensitive executor detail"))
            .doAnswer(invocation -> {
                invocation.getArgument(0, Runnable.class).run();
                return null;
            })
            .when(executor).execute(any(Runnable.class));
        SearchReindexGuard guard = new SearchReindexGuard();
        SearchReindexService rejectingService = new SearchReindexService(listingIndexer, searchIndexManager,
            guard, executor);
        when(listingIndexer.reindexAll()).thenReturn(1);

        assertThatThrownBy(() -> rejectingService.start(SearchReindexMode.IN_PLACE))
            .isInstanceOf(RejectedExecutionException.class);

        SearchReindexJob recovered = rejectingService.start(SearchReindexMode.IN_PLACE);
        assertThat(rejectingService.get(recovered.jobId()).state()).isEqualTo(SearchReindexState.SUCCEEDED);
    }

    @Test
    void rebuild는_검증_후_alias를_전환하고_catch_up한다() throws Exception {
        when(searchIndexManager.createNextIndex()).thenReturn("listings_v2");
        when(listingIndexer.sourceCounts()).thenReturn(new SearchIndexCounts(2, 1));
        when(listingIndexer.reindexAll("listings_v2")).thenReturn(3);
        when(listingIndexer.reindexAll()).thenReturn(3);

        SearchReindexJob accepted = service.start(SearchReindexMode.REBUILD);
        SearchReindexJob completed = awaitTerminal(accepted.jobId());

        assertThat(completed.state()).isEqualTo(SearchReindexState.SUCCEEDED);
        assertThat(completed.targetIndex()).isEqualTo("listings_v2");
        assertThat(completed.aliasSwitched()).isTrue();
        verify(searchIndexManager).verifyCounts("listings_v2", new SearchIndexCounts(2, 1));
        verify(searchIndexManager).switchAlias("listings_v2");
        verify(listingIndexer).reindexAll();
    }

    @Test
    void 검증_실패면_alias를_전환하지_않고_failed다() throws Exception {
        when(searchIndexManager.createNextIndex()).thenReturn("listings_v2");
        when(listingIndexer.sourceCounts()).thenReturn(new SearchIndexCounts(2, 1));
        when(listingIndexer.reindexAll("listings_v2")).thenReturn(3);
        doAnswer(invocation -> {
            throw new IllegalStateException("count mismatch");
        }).when(searchIndexManager).verifyCounts("listings_v2", new SearchIndexCounts(2, 1));

        SearchReindexJob accepted = service.start(SearchReindexMode.REBUILD);
        SearchReindexJob completed = awaitTerminal(accepted.jobId());

        assertThat(completed.state()).isEqualTo(SearchReindexState.FAILED);
        assertThat(completed.aliasSwitched()).isFalse();
        assertThat(completed.error()).isEqualTo("신규 검색 인덱스 데이터 검증에 실패했습니다.");
    }

    private SearchReindexJob awaitTerminal(String jobId) throws InterruptedException {
        for (int attempt = 0; attempt < 100; attempt++) {
            SearchReindexJob job = service.get(jobId);
            if (!job.active()) {
                return job;
            }
            Thread.sleep(10L);
        }
        throw new AssertionError("job이 종료되지 않았습니다.");
    }
}
