/**
 * 아이템 위치(location) 표기 (FC-077 — 계약 §4.1 / 백엔드 `ItemLocation` 실측).
 *
 * ★ 백엔드 enum 은 **INVENTORY·TEMP·LISTED** 3값이다(design-brief B-11 의 "AUCTION" 은 실측
 *   enum 명이 아니다 — 출품 상태의 실제 이름은 `LISTED`). 서버가 `@Enumerated(STRING)` 으로 이름
 *   그대로 직렬화하므로 그 이름을 정본으로 삼는다.
 * ★ 폴백 의무(§3.3): 사전에 없는 값은 중립 표기로 흘리고, 코드 집합 크기를 하드코딩하지 않는다 —
 *   서버가 새 위치를 먼저 배포할 수 있다(`element`·`itemCode` 와 같은 태도).
 */
import type { ItemLocation } from '@/lib/api/items'

/** 위치 → 사용자 표기. 색이 아니라 **글자가 정보**다(배지가 색 단독으로 구분되지 않으므로). */
const LOCATION_LABELS: Record<string, string> = {
    INVENTORY: '인벤토리 보관 중',
    TEMP: '임시 보관 중',
    LISTED: '경매 출품 중',
}

/** 위치 표시 라벨. 미등록 값은 값 자체를 노출한다(무음 실패 방지). */
export function itemLocationLabel(location: ItemLocation): string {
    return LOCATION_LABELS[location] ?? `위치 ${location}`
}
