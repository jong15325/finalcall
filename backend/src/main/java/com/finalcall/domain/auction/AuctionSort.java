package com.finalcall.domain.auction;

import java.util.Arrays;

/**
 * 경매 목록 정렬 화이트리스트(auction, 계약 §3 정렬 화이트리스트). 요청 {@code sort=<field>,<asc|desc>}의 field 를
 * 이 enum 으로만 허용해 임의 컬럼 정렬(인덱스 밖·SQL 표면적)을 막는다(B-006). 미지정·미허용 값은 기본값으로 폴백한다.
 *
 * <p>{@code HIGHEST_BID_AMOUNT}는 본 에픽 전건 NULL(입찰 미구현, 게이트2 b)이라 실질 정렬 효과가 없으나
 * 화이트리스트에 유지한다(EPIC-BID 대비, 계약 무변경).
 */
public enum AuctionSort {

    PRICE("price"),
    END_AT("endAt"),
    CREATED_AT("createdAt"),
    HIGHEST_BID_AMOUNT("highestBidAmount");

    /** 목록 기본 정렬(마감 임박 순, spec §5.2). */
    public static final AuctionSort DEFAULT = END_AT;

    private final String field;

    AuctionSort(String field) {
        this.field = field;
    }

    /** 요청 field 문자열을 enum 으로 해석한다. null·미허용 값은 {@link #DEFAULT}로 폴백한다(화이트리스트). */
    public static AuctionSort from(String field) {
        if (field == null || field.isBlank()) {
            return DEFAULT;
        }
        return Arrays.stream(values())
            .filter(sort -> sort.field.equalsIgnoreCase(field))
            .findFirst()
            .orElse(DEFAULT);
    }
}
