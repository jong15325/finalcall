package com.finalcall.domain.search.entity;

/**
 * 리스팅 종류 판별(search, EPIC-SEARCH). 단일 통합 인덱스 {@code listings} 안에서 경매/고정가를 구분하는 keyword
 * 축이다(search-spec §12.4). {@code GET /auctions}·{@code GET /shops} 는 이 값으로 term 필터해 각자 결과만 얻는다.
 */
public enum ListingType {

    AUCTION,
    SHOP
}
