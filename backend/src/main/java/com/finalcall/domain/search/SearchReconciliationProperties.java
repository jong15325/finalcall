package com.finalcall.domain.search;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 검색 화해 잡 파라미터(search, search-spec §12.5). MySQL(정본)↔ES(파생) count 드리프트를 주기 대조하는 백스톱이다
 * (CDC 유실·순서역전·커넥터 정지 대비, domain-spec §8 "정합성은 DB" 의 검색판).
 *
 * <p>{@code enabled} 는 스케줄 tick 활성 여부다 — 통합 테스트는 {@code false} 로 배경 tick 을 끄고 로직을 직접 호출해
 * 결정적으로 검증한다(ShopExpiryWorker 선례). 화해는 시급성이 낮아 긴 주기(기본 5분)로 부하를 아낀다.
 * {@code correctOnDrift} 가 true 면 드리프트 탐지 시
 * {@link com.finalcall.domain.search.service.ListingIndexer#reindexAll()} 로 보정한다 — 기본 false
 * (탐지·경고만; bulk 재색인은 부하가 커 운영자가 명시 활성).
 *
 * <p>{@code priceBucketSize} 는 가격 히스토그램 대조의 버킷 폭이다(§12.5 price histogram) — MySQL
 * {@code floor(price/size)*size} 집계와 ES {@code histogram interval} 을 같은 하한 키로 정렬해 어느 가격대가
 * 어긋났는지까지 짚는다. 총량·상태 분포가 일치해도 가격대 분포가 어긋나는 드리프트를 잡는다.
 */
@Validated
@ConfigurationProperties(prefix = "search.reconciliation")
public record SearchReconciliationProperties(

    /** 스케줄 tick 처리 활성 여부. 운영 true, 통합 테스트 false(직접 호출로 결정적 검증). */
    boolean enabled,

    /** 폴링 간격(ms). {@code @Scheduled(fixedDelayString)} 이 참조한다. */
    @Positive long fixedDelayMs,

    /** 드리프트 탐지 시 재색인 보정 여부(기본 false=탐지·경고만). */
    boolean correctOnDrift,

    /** 가격 히스토그램 버킷 폭(§12.5). MySQL {@code floor(price/size)*size} ↔ ES {@code histogram interval} 정합. */
    @Positive long priceBucketSize) {
}
