package com.finalcall.api.item;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.item.TempStorage;
import com.finalcall.domain.item.TempStorageSlice;

import lombok.Builder;

/**
 * 임시보관 커서 응답(item, FC-022) — 계약 §4.2. content 항목 + 다음 커서(opaque) + hasNext.
 */
@Builder
public record TempStorageResponse(
    List<TempStorageItem> content,
    String nextCursor,
    boolean hasNext) {

    public static TempStorageResponse from(TempStorageSlice slice) {
        return TempStorageResponse.builder()
            .content(slice.items().stream().map(TempStorageItem::from).toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }

    /** 임시보관 항목 — 공개 식별자 + 보관 시각/기한 + 공용 요약. */
    @Builder
    public record TempStorageItem(
        String itemInstancePublicId,
        Instant storedAt,
        Instant expireAt,
        ItemSummaryResponse summary) {

        public static TempStorageItem from(TempStorage temp) {
            return TempStorageItem.builder()
                .itemInstancePublicId(temp.getInstance().getPublicId())
                .storedAt(temp.getStoredAt())
                .expireAt(temp.getExpireAt())
                .summary(ItemSummaryResponse.from(temp.getInstance()))
                .build();
        }
    }
}
