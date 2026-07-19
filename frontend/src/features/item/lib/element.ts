/**
 * 아이템 속성(element) 코드 ↔ 표시 매핑.
 *
 * 계약 [3.3] item 블록의 `element`는 **정수 코드**다(erd item_template.element INT "속성(물/불/흙/바람) — 십의 자리").
 *
 * ★ **코드값 정본은 계약 v1.10 §3.3.1(아이템 코드 사전)이며 1~4 전량 확정됐다** — `1=물 · 2=불 ·
 * 3=흙 · 4=바람`. v1.9까지는 시드에서 관측되는 1·2만 확정이고 3·4는 erd 서술의 나열 순서로 **추정**될
 * 뿐이라 등재하지 않았으나, v1.10이 원게임 실데이터 전수 조회로 4축을 확정하며 그 유보가 해소됐다.
 *
 * ★ **폴백 의무는 그대로 남는다**(계약 v1.10 §3.3 "폴백 의무는 유지된다"). 현재 미확정 코드는 없지만
 * (1) 축이 장차 확장될 수 있고 (2) 서버·클라이언트 배포 시차 동안 신규 코드가 먼저 내려올 수 있다.
 * 사전에 없는 코드는 중립 표기("속성 N")로 폴백하고, 코드 집합 크기를 가정한 하드코딩(배열 인덱싱·
 * exhaustive switch)을 두지 않는다 — 소비처는 전부 이 모듈이 내보내는 목록·폴백 함수만 쓴다.
 *
 * 색 사용은 design-system [1.2] Game-Color Containment 를 따른다 — element 색은
 * **아이템 카드·속성 배지·아이템 필터 칩 안에서만** 쓴다(버튼·탭·크롬·링크 금지).
 */

/** 속성 키 = 디자인 토큰 `element.*` 와 1:1(design-system [2.7]). */
export type ElementKey = 'water' | 'fire' | 'earth' | 'wind';

/**
 * ★ 정본이 확정한 코드를 등재한다(계약 v1.10 §3.3.1). 이 목록이 코드↔키의 단일 진실이며
 * 필터 칩의 표시 순서이기도 하다. 여기 없는 코드는 전부 미등록 폴백으로 흐른다.
 */
export const ELEMENT_CODES: readonly { code: number; key: ElementKey }[] = [
  { code: 1, key: 'water' },
  { code: 2, key: 'fire' },
  { code: 3, key: 'earth' },
  { code: 4, key: 'wind' },
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
 * ★ **흙·바람 파생(FC-049) — 창작이 아니라 정본이 남긴 공식의 적용이다.**
 * [2.7]은 물·불 두 값만 두고 "**3·4가 확정되면 같은 방식(L18% S61% 코어 / L11% 엣지)으로
 * 파생한다**"는 조건부 지시를 남겼다. 계약 v1.10 §3.3.1 이 element 1~4를 전건 확정해 그 조건이
 * 충족됐고, FC-042 목업이 아트 실측 hue에 공식을 적용해 값을 산출했다(대비 재계산 포함, 전건 AA).
 * 종전 주석의 "미확정이라 중립 폴백" 유보는 그 확정으로 해소됐다. 색값 정본은 tailwind.config.js.
 *
 * 속성 판별은 여전히 ElementBadge(도트 + 속성명)가 책임진다([1.2]③) — 글로우는 보조 신호다.
 */
export const ELEMENT_SLOT_GLOW_CLASS: Record<ElementKey, string> = {
  water: 'slot-glow-water',
  fire: 'slot-glow-fire',
  earth: 'slot-glow-earth',
  wind: 'slot-glow-wind',
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
