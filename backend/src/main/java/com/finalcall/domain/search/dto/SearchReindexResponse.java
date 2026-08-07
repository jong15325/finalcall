package com.finalcall.domain.search.dto;

import java.time.Instant;

import lombok.Builder;

/** 관리자 검색 재색인 작업 상태 응답. */
@Builder
public record SearchReindexResponse(
    String jobId,
    String mode,
    String state,
    Instant startedAt,
    Instant finishedAt,
    String targetIndex,
    int indexedCount,
    boolean aliasSwitched,
    String error) {
}
