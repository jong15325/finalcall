package com.finalcall.api.item;

import java.util.List;

import com.finalcall.domain.item.InventoryData;
import com.finalcall.domain.item.ItemInstance;

import lombok.Builder;

/**
 * 정규 인벤토리 응답(item, FC-022) — 계약 §4.2 {@code { capacity:96, used, items[slotNo] }}.
 * 비페이지네이션 단일 응답(96칸 상한). 항목은 slotNo asc(리포지토리 정렬).
 */
@Builder
public record InventoryResponse(
    int capacity,
    int used,
    List<InventoryItem> items) {

    public static InventoryResponse from(InventoryData data) {
        return InventoryResponse.builder()
            .capacity(data.capacity())
            .used(data.items().size())
            .items(data.items().stream().map(InventoryItem::from).toList())
            .build();
    }

    /** 인벤토리 슬롯 항목 — 공개 식별자 + 슬롯 번호 + 공용 요약. */
    @Builder
    public record InventoryItem(
        String itemInstancePublicId,
        int slotNo,
        ItemSummaryResponse summary) {

        public static InventoryItem from(ItemInstance instance) {
            return InventoryItem.builder()
                .itemInstancePublicId(instance.getPublicId())
                .slotNo(instance.getSlotNo())
                .summary(ItemSummaryResponse.from(instance))
                .build();
        }
    }
}
