package com.finalcall.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;

class SearchReindexGuardTest {

    @Test
    void 관리자_job과_화해_보정이_동시에_경합해도_한쪽만_진입한다() throws Exception {
        SearchReindexGuard guard = new SearchReindexGuard();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger entered = new AtomicInteger();
        AtomicInteger concurrent = new AtomicInteger();
        AtomicInteger maxConcurrent = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Runnable contender = () -> {
            ready.countDown();
            try {
                start.await();
                if (guard.tryAcquire()) {
                    entered.incrementAndGet();
                    int active = concurrent.incrementAndGet();
                    maxConcurrent.accumulateAndGet(active, Math::max);
                    Thread.sleep(50L);
                    concurrent.decrementAndGet();
                    guard.release();
                }
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
        };
        try {
            pool.submit(contender);
            pool.submit(contender);
            assertThat(ready.await(1, TimeUnit.SECONDS)).isTrue();
            start.countDown();
        } finally {
            pool.shutdown();
            assertThat(pool.awaitTermination(3, TimeUnit.SECONDS)).isTrue();
        }

        assertThat(entered).hasValue(1);
        assertThat(maxConcurrent).hasValue(1);
    }
}
