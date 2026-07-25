package com.finalcall.domain.item.dto;

/**
 * relocate 응답(item, FC-022) — 계약 §4.2 {@code { slotNo }}(확정된 정규 슬롯 번호).
 *
 * @param slotNo 이동 완료된 정규 인벤토리 슬롯 번호
 */
public record RelocateResponse(int slotNo) {
}
