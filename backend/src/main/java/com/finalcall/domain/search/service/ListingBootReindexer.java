package com.finalcall.domain.search.service;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.finalcall.domain.search.config.ListingSearchProperties;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 부팅 시 전체 색인기(search, EPIC-SEARCH · MAJOR-1). Debezium CDC 는 auction/shop 단일 테이블의 <b>스냅샷 필드</b>
 * (nameSnapshot·price·status·listingType)만 채운다 — 코드축(mainCategory 등)·level·skill·gfExpireAt·endsAt 같은
 * <b>join 필드는 item 소재라 단일 테이블 CDC 로 못 채운다</b>. 그래서 앱 enrichment({@link ListingIndexer}, 정본 조인
 * 읽어 upsert)로 채워야 검색이 온전히 동작한다.
 *
 * <p>이 컴포넌트가 그 enrichment 를 <b>실제로 실행</b>한다(리뷰 지적: enrichment 가 실행되지 않으면 검색 문서≈0). 컨텍스트
 * 준비 완료({@link ApplicationReadyEvent}) 후 1회 전체 재색인해 검색 가능 문서를 보장하고, 이후 CDC 가 스냅샷 필드를
 * 근실시간 갱신하며 주기 화해({@link SearchReconciliationWorker})가 드리프트를 보정한다("CDC=스냅샷 필드 + 앱
 * enrichment=join 필드 + 주기 화해" 정합, search-spec §12.5).
 *
 * <p>로컬 데모 기본 on({@code search.reindex-on-startup=true}), 운영/통합 테스트 off. ES 미가용 시 부팅을 막지 않고
 * 스킵한다(ES 는 파생 read-model — 없어도 앱은 뜬다). {@code @EventListener} 라 self-invocation 함정과 무관하다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ListingBootReindexer {

    private final ListingIndexer listingIndexer;
    private final ListingSearchProperties properties;

    /** 컨텍스트 준비 후 전체 재색인(gated). ES 미가용 등 실패는 로깅 후 스킵 — 부팅을 막지 않는다. */
    @EventListener(ApplicationReadyEvent.class)
    public void reindexOnStartup() {
        if (!properties.reindexOnStartup()) {
            return;
        }
        try {
            int indexed = listingIndexer.reindexAll();
            log.info("검색 부팅 재색인 완료 — enrichment 문서 {}건 색인(코드축 포함)", indexed);
        } catch (RuntimeException ex) {
            log.error("검색 부팅 재색인 실패(ES 미가용 가능) — 스킵. 주기 화해가 이후 보정한다", ex);
        }
    }
}
