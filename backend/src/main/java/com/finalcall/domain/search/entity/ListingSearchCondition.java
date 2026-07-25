package com.finalcall.domain.search.entity;

import java.util.List;

/**
 * 검색 질의 조건(search, 계약 C1~C3 · search-spec §12.4·§12.7). {@code q}(자유문)는 query context(관련도),
 * 나머지 코드축·범위·상태는 filter context 로 <b>AND 결합</b>한다(계약 C1). 전부 optional 이며 null 은 미필터다.
 *
 * <p>{@code goldforceActive}=TRUE 는 색인된 boolean 이 아니라 {@code gfExpireAt > now} range 로 판정한다(색인 시점
 * 스테일 회피, §12.4). {@code statuses} 는 노출 상태 화이트리스트다 — 경매 기본은 (SCHEDULED,ACTIVE), 고정가 기본은
 * (ACTIVE)이며 호출 측이 MySQL 목록 경로와 동일한 규약으로 채운다. 코드축·skill 은 keyword 색인이라 문자열로 비교한다.
 *
 * @param listingType 리스팅 종류(AUCTION|SHOP) — term 필터
 * @param q           자유문(2~64자, 계약 C3). 검증은 {@link com.finalcall.domain.search.service.ListingSearchService} 진입에서 수행
 * @param statuses    노출 상태 화이트리스트(비었으면 상태 미필터)
 */
public record ListingSearchCondition(
    ListingType listingType,
    String q,
    Integer mainCategory,
    Integer subGroup,
    Integer element,
    Integer kind,
    Integer minLevel,
    Integer maxLevel,
    Integer skill1,
    Integer skill2,
    Boolean goldforceActive,
    Long minPrice,
    Long maxPrice,
    List<String> statuses) {
}
