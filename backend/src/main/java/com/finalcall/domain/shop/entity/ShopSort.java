package com.finalcall.domain.shop.entity;

import java.util.Locale;

/**
 * 고정가 목록 정렬 화이트리스트(shop, shop-spec §6 · api-contract §3.2). 임의 컬럼·SQL 표면적을 차단하기 위해
 * enum 으로만 허용한다(B-006). 기본은 {@link #CREATED_AT}(최신 등록순).
 *
 * <p>{@code endAt} 은 이 에픽 등록 경로에서 항상 유한 값이라 keyset 정렬에 안전하다(무기한 NULL 은 향후 캐시아이템
 * 전용·범위 밖). {@code price}·{@code createdAt} 은 NOT NULL 이다.
 */
public enum ShopSort {

    CREATED_AT,
    PRICE,
    END_AT;

    /** 기본 정렬(최신 등록순 desc). */
    public static final ShopSort DEFAULT = CREATED_AT;

    /** 미허용·미지정 field 는 기본값으로 흡수한다(임의 정렬 컬럼 차단). */
    public static ShopSort from(String field) {
        if (field == null || field.isBlank()) {
            return DEFAULT;
        }
        return switch (field.trim().toLowerCase(Locale.ROOT)) {
            case "price" -> PRICE;
            case "endat", "end_at" -> END_AT;
            default -> CREATED_AT;
        };
    }
}
