package com.finalcall.domain.item.dto;

import java.time.Instant;

import com.finalcall.domain.item.entity.TempStorage;

import lombok.Builder;

/**
 * 임시보관 항목 응답(item, FC-022) — 계약 §4.2 커서 목록의 content 항목.
 *
 * <p>공개 식별자 + 보관 시각/기한 + 공용 요약. 커서 봉투는 공용 {@link com.finalcall.common.response.CursorResponse}가
 * 담당한다(FC-126) — 이 타입은 그 봉투의 항목 타입으로 주입된다.
 */
@Builder
public record TempStorageItemResponse(
    String itemInstancePublicId,
    Instant storedAt,
    Instant expireAt,
    ItemSummaryResponse summary) {

    public static TempStorageItemResponse from(TempStorage temp) {
        return TempStorageItemResponse.builder()
            .itemInstancePublicId(temp.getInstance().getPublicId())
            .storedAt(temp.getStoredAt())
            .expireAt(temp.getExpireAt())
            .summary(ItemSummaryResponse.from(temp.getInstance()))
            .build();
    }
}
