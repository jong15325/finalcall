package com.finalcall.domain.search.service;

/** 비동기 검색 재색인 작업 상태. */
public enum SearchReindexState {
    PENDING,
    RUNNING,
    SUCCEEDED,
    FAILED
}
