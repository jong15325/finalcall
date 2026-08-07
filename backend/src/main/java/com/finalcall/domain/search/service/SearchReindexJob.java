package com.finalcall.domain.search.service;

import java.time.Instant;

/** 단일 인스턴스에서 보관하는 검색 재색인 작업 스냅샷. */
public record SearchReindexJob(
    String jobId,
    SearchReindexMode mode,
    SearchReindexState state,
    Instant startedAt,
    Instant finishedAt,
    String targetIndex,
    int indexedCount,
    boolean aliasSwitched,
    String error) {

    public static SearchReindexJob pending(String jobId, SearchReindexMode mode) {
        return new SearchReindexJob(jobId, mode, SearchReindexState.PENDING, Instant.now(), null, null, 0, false, null);
    }

    public SearchReindexJob running(String targetIndex) {
        return new SearchReindexJob(jobId, mode, SearchReindexState.RUNNING, startedAt, null, targetIndex, 0, false,
            null);
    }

    public SearchReindexJob succeeded(int indexedCount, boolean aliasSwitched) {
        return new SearchReindexJob(jobId, mode, SearchReindexState.SUCCEEDED, startedAt, Instant.now(), targetIndex,
            indexedCount, aliasSwitched, null);
    }

    public SearchReindexJob aliasSwitched(int indexedCount) {
        return new SearchReindexJob(jobId, mode, SearchReindexState.RUNNING, startedAt, null, targetIndex,
            indexedCount, true, null);
    }

    public SearchReindexJob failed(String error) {
        return new SearchReindexJob(jobId, mode, SearchReindexState.FAILED, startedAt, Instant.now(), targetIndex,
            indexedCount, aliasSwitched, error);
    }

    public boolean active() {
        return state == SearchReindexState.PENDING || state == SearchReindexState.RUNNING;
    }
}
