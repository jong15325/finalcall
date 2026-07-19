/**
 * 아이템 속성(element) 코드 ↔ 표시 매핑.
 *
 * 계약 [3.3] item 블록의 `element`는 **정수 코드**다(erd item_template.element INT "속성(물/불/흙/바람) — 십의 자리").
 *
 * ★ **코드값 정본은 1·2 뿐이다**(계약 v1.9 §3.3). erd 는 축의 의미만 규정하고 코드↔속성 매핑을 열거하지
 * 않는다. 시드(V9__item_seed.sql)로 확인되는 값도 `1=물`·`2=불` 둘뿐이며, `3`·`4`는 erd 서술의 나열
 * 순서로 흙·바람이 **추정**될 뿐 근거가 없어 계약이 확정하지 않았다. 따라서 아래 표에 3·4를 등재하지
 * 않는다 — 등재하면 필터 칩이 항상 빈 목록을 내고, 나중에 3=바람으로 밝혀질 때 배지·아트 슬롯·상세
 * 속성명이 **조용히 오표기**된다(무음 실패). 미등록 코드는 중립 표기("속성 N")로 폴백한다.
 * EPIC-ITEM 시드 확장에서 실측 확정되면 `ELEMENT_CODES` 에 줄만 추가하면 복구된다.
 *
 * 코드 집합 크기를 가정한 하드코딩(배열 인덱싱·exhaustive switch)을 두지 않는다 — 소비처는 전부
 * 이 모듈이 내보내는 목록·폴백 함수를 통해서만 코드를 다룬다.
 *
 * 색 사용은 design-system [1.2] Game-Color Containment 를 따른다 — element 색은
 * **아이템 카드·속성 배지·아이템 필터 칩 안에서만** 쓴다(버튼·탭·크롬·링크 금지).
 */

/**
 * 속성 키 = 디자인 토큰 `element.*` 와 1:1(design-system [2.7]).
 * 토큰은 4색이 확정값이라 키 타입은 4종 그대로 둔다 — 미확정인 것은 **코드↔키 매핑**이지 토큰이 아니다.
 */
export type ElementKey = 'water' | 'fire' | 'earth' | 'wind';

/**
 * ★ 정본이 확정한 코드만 등재한다(계약 v1.9 §3.3). 이 목록이 코드↔키의 단일 진실이며
 * 필터 칩의 표시 순서이기도 하다. 여기 없는 코드는 전부 미등록 폴백으로 흐른다.
 */
export const ELEMENT_CODES: readonly { code: number; key: ElementKey }[] = [
  { code: 1, key: 'water' },
  { code: 2, key: 'fire' },
];

/** 속성명(색 단독 전달 금지 — 배지·칩은 이 라벨을 항상 병기한다, accessibility [2]). */
export const ELEMENT_LABEL: Record<ElementKey, string> = {
  water: '물',
  fire: '불',
  earth: '흙',
  wind: '바람',
};

/**
 * 라이트 패턴 클래스(design-system [2.7]): 소프트 틴트 배경 + near-black 라벨.
 * 흰 배경 위 element 텍스트 직접 사용은 금지다(water 2.37 로 무너진다).
 * Tailwind JIT 가 클래스명을 정적으로 스캔하므로 문자열을 조립하지 않고 표로 둔다.
 */
export const ELEMENT_TINT_CLASS: Record<ElementKey, string> = {
  water: 'bg-element-soft-water',
  fire: 'bg-element-soft-fire',
  earth: 'bg-element-soft-earth',
  wind: 'bg-element-soft-wind',
};

/** solid element 도트(소면적 hue 노출). 라벨이 항상 병기되므로 도트 자체는 정보 전달 주체가 아니다. */
export const ELEMENT_DOT_CLASS: Record<ElementKey, string> = {
  water: 'bg-element-water',
  fire: 'bg-element-fire',
  earth: 'bg-element-earth',
  wind: 'bg-element-wind',
};

/** 아트 슬롯 글로우 위 element 윤곽 — 글로우 위 대비 5.0~9.8:1([2.7], v0.5 재계산). */
export const ELEMENT_BORDER_CLASS: Record<ElementKey, string> = {
  water: 'border-element-water',
  fire: 'border-element-fire',
  earth: 'border-element-earth',
  wind: 'border-element-wind',
};

/**
 * 아트 슬롯 딥 글로우(design-system [2.7], v0.5 — 종전 `bg-surface-slot` 단일 검정 폐기).
 * 실제 그라데이션은 index.css 의 `.slot-glow-*` 유틸이 갖는다.
 *
 * ★ **확정 element 는 1(물)·2(불)뿐이라 글로우도 둘만 있다**(계약 v1.9 §3.3). 미확정 속성(3·4)과
 * 무속성은 `SLOT_GLOW_NEUTRAL` 로 폴백한다 — 근거 없는 hue 를 지어내면 나중에 3=바람으로 밝혀질 때
 * 슬롯 배경이 조용히 오표기된다(ELEMENT_CODES 가 3·4 를 등재하지 않는 것과 같은 이유).
 */
export const ELEMENT_SLOT_GLOW_CLASS: Record<ElementKey, string> = {
  water: 'slot-glow-water',
  fire: 'slot-glow-fire',
  earth: 'slot-glow-neutral',
  wind: 'slot-glow-neutral',
};

/** 미등록·무속성 슬롯 폴백. */
export const SLOT_GLOW_NEUTRAL = 'slot-glow-neutral';

/** 코드 → 키. **미등록(미확정) 코드는 null** — 소비처는 중립 표기로 폴백한다. */
export function toElementKey(code: number): ElementKey | null {
  return ELEMENT_CODES.find((entry) => entry.code === code)?.key ?? null;
}

/** 코드 → 표시 라벨. 미등록 코드는 코드 자체를 노출한다(무음 실패 방지). */
export function elementLabelOf(code: number): string {
  const key = toElementKey(code);
  return key ? ELEMENT_LABEL[key] : `속성 ${code}`;
}
