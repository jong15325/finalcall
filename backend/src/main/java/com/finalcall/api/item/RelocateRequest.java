package com.finalcall.api.item;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * relocate 요청(item, FC-022) — 계약 §4.2 body {@code { slotNo? }}. 미지정(null)이면 빈 슬롯 자동 배정.
 * 범위(0~95)는 형식 검증으로 강제한다(위반 시 400). 점유·만실은 서비스가 INV_001/INV_002 로 판정한다.
 *
 * @param slotNo 명시 슬롯 번호(0~95, optional)
 */
public record RelocateRequest(
    @Min(0) @Max(95) Integer slotNo) {
}
