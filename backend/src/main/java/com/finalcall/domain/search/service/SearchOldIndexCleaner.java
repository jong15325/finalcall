package com.finalcall.domain.search.service;

import java.time.Instant;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** 보존 기한이 지난 검색 구 인덱스를 주기적으로 정리한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchOldIndexCleaner {

    private final SearchIndexManager searchIndexManager;

    @Scheduled(fixedDelayString = "${search.reindex.cleanup-fixed-delay-ms:60000}")
    public void cleanup() {
        try {
            searchIndexManager.cleanupExpiredOldIndices(Instant.now());
        } catch (RuntimeException ex) {
            log.error("검색 구 인덱스 정리 실패 — 다음 주기에 재시도합니다.", ex);
        }
    }
}
