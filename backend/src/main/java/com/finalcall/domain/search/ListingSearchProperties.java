package com.finalcall.domain.search;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 검색 질의 파라미터(search, 계약 C3 · search-spec §12.4·§12.7).
 *
 * <p>{@code indexAlias} = 앱이 질의하는 읽기 alias(§12.5 무중단 재색인 — 물리 인덱스가 아니라 alias 로만 질의한다).
 * {@code minQueryLength}=2 는 ngram {@code min_gram=2} 와 정합하고, {@code maxQueryLength}=64 는 비용 상한이다
 * (계약 C3, 위반 시 400 COMMON). 하드코딩 금지·운영 튜닝 여지라 설정으로 뺀다({@code @Validated} 로 빈/음수 부팅 차단).
 */
@Validated
@ConfigurationProperties(prefix = "search")
public record ListingSearchProperties(

    /** 앱이 질의하는 읽기 alias(재색인은 이 alias 를 원자 스위치, §12.5). */
    @NotBlank String indexAlias,

    /** {@code q} 최소 길이(ngram min_gram 정합). 미만 → 400(COMMON). */
    @Positive int minQueryLength,

    /** {@code q} 최대 길이(비용 상한). 초과 → 400(COMMON). */
    @Positive int maxQueryLength,

    /**
     * 부팅 시 전체 재색인 여부(EPIC-SEARCH, MAJOR-1). CDC 는 단일 테이블 스냅샷 필드만 채우므로 코드축·레벨·스킬·
     * 날짜 같은 join 필드는 앱 enrichment({@link com.finalcall.domain.search.service.ListingIndexer})가 채워야 한다 — 이 값이 true 면
     * {@code ApplicationReadyEvent} 에 전체 색인을 1회 수행해 검색 가능 문서를 보장한다(로컬 데모 기본 on, 운영/테스트
     * off). ES 미가용 시 부팅을 막지 않고 스킵한다.
     */
    boolean reindexOnStartup) {
}
