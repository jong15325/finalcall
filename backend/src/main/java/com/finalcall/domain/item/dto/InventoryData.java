package com.finalcall.domain.item.dto;

import java.util.List;

import com.finalcall.domain.item.entity.ItemInstance;

/**
 * 정규 인벤토리 조회 결과(item, 도메인 반환 타입). 용량 상수와 슬롯 점유 목록을 담아 api 계층이 응답으로 변환한다.
 *
 * @param capacity 인벤토리 용량(96칸 상수, spec §3.3)
 * @param items    점유 슬롯 아이템(slotNo asc, 템플릿·스킬 fetch join 됨)
 */
public record InventoryData(int capacity, List<ItemInstance> items) {
}
