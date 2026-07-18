/**
 * 아이템 속성(element) 코드 ↔ 표시 매핑.
 *
 * 계약 [3.3] item 블록의 `element`는 **정수 코드**다(erd item_template.element INT "속성(물/불/흙/바람) — 십의 자리").
 * 코드값은 erd 열거 순서 + 시드(V9__item_seed.sql: 1=물의 검/도, 2=불의 검/도)로 확정한 1·2를 기준으로,
 * 나머지 3·4를 문서 순서(흙·바람)에 맞춘다. 시드에 3·4가 없어 실측 확인은 EPIC-ITEM 시드 확장 시로 이연한다.
 *
 * 색 사용은 design-system [1.2] Game-Color Containment 를 따른다 — element 색은
 * **아이템 카드·속성 배지·아이템 필터 칩 안에서만** 쓴다(버튼·탭·크롬·링크 금지).
 */

/** 4속성 키(디자인 토큰 element.* 와 1:1). */
export type ElementKey = 'water' | 'fire' | 'earth' | 'wind';

/** 코드 → 키. 미등록 코드는 undefined(표시는 '속성 미상'으로 폴백). */
const CODE_TO_KEY: Record<number, ElementKey> = {
  1: 'water',
  2: 'fire',
  3: 'earth',
  4: 'wind',
};

const KEY_TO_CODE: Record<ElementKey, number> = {
  water: 1,
  fire: 2,
  earth: 3,
  wind: 4,
};

/** 속성명(색 단독 전달 금지 — 배지·칩은 이 라벨을 항상 병기한다, accessibility [2]). */
export const ELEMENT_LABEL: Record<ElementKey, string> = {
  water: '물',
  fire: '불',
  earth: '흙',
  wind: '바람',
};

/** 필터 칩·범례의 표시 순서. */
export const ELEMENT_KEYS: ElementKey[] = ['water', 'fire', 'earth', 'wind'];

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

/** 검정 아트 슬롯(#000) 위 element 윤곽 — 슬롯 위 대비 6.5~11:1([2.7]). */
export const ELEMENT_BORDER_CLASS: Record<ElementKey, string> = {
  water: 'border-element-water',
  fire: 'border-element-fire',
  earth: 'border-element-earth',
  wind: 'border-element-wind',
};

/** 코드 → 키. 미등록 코드는 null. */
export function toElementKey(code: number): ElementKey | null {
  return CODE_TO_KEY[code] ?? null;
}

/** 키 → 코드(목록 필터 쿼리 파라미터 `element`는 정수다). */
export function toElementCode(key: ElementKey): number {
  return KEY_TO_CODE[key];
}

/** 코드 → 표시 라벨. 미등록 코드는 코드 자체를 노출한다(무음 실패 방지). */
export function elementLabelOf(code: number): string {
  const key = toElementKey(code);
  return key ? ELEMENT_LABEL[key] : `속성 ${code}`;
}
