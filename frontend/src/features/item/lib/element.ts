/**
 * 아이템 속성(element) 코드 ↔ 표시 매핑 (FC-058 이식).
 *
 * 계약 v1.10 §3.3.1 이 코드 1~4 를 전량 확정했다 — `1=물 · 2=불 · 3=흙 · 4=바람`.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **색 매핑을 이 모듈에 두지 않는다** (사용자 방침 2026-07-19).
 * ══════════════════════════════════════════════════════════════════════════════
 * 구 프론트의 이 파일은 속성별 hex 토큰 5벌(`ELEMENT_TINT_CLASS`·`ELEMENT_DOT_CLASS`·
 * `ELEMENT_BORDER_CLASS`·`ELEMENT_SLOT_GLOW_CLASS`·`SLOT_GLOW_NEUTRAL`)을 함께 내보냈다.
 * 방침이 "시각은 전부 템플릿"으로 바뀌면서 **전부 폐기**했고, 이식하지 않았다.
 * 되살리지 마라 — 이 파일에 색이 다시 들어오는 순간 우리 팔레트가 앱 전체로 번진다.
 *
 * ★★ **그 결과 속성 간 색 구분이 사라진다**(템플릿 `Tag` 기본색 4종은 서로 같다).
 *    → **라벨 텍스트가 유일한 판별 채널**이 된다. 접근성(WCAG 1.4.1) 이전에 **기능 요건**이다.
 *    소비처는 반드시 `elementLabelOf`(또는 `elementBadgeLabelOf`)를 화면에 **글자로** 출력한다.
 *
 * ★ 폴백 의무(계약 v1.10 §3.3): 사전에 없는 코드는 중립 표기("속성 N")로 흘리고,
 *   코드 집합 크기를 가정한 하드코딩(배열 인덱싱·exhaustive switch)을 두지 않는다.
 *   축이 확장될 수 있고, 서버·클라 배포 시차 동안 신규 코드가 먼저 내려올 수 있다.
 */

/** 속성 키 = 아트 디렉터리명과 1:1(`/art/items/level{n}/{l|s}/{key}/…`). */
export type ElementKey = 'water' | 'fire' | 'earth' | 'wind'

/**
 * 코드 ↔ 키의 단일 진실(계약 v1.10 §3.3.1). 필터의 표시 순서이기도 하다.
 * 여기 없는 코드는 전부 미등록 폴백으로 흐른다.
 */
export const ELEMENT_CODES: readonly { code: number; key: ElementKey }[] = [
    { code: 1, key: 'water' },
    { code: 2, key: 'fire' },
    { code: 3, key: 'earth' },
    { code: 4, key: 'wind' },
]

/** 속성명. **색이 없으므로 이 글자가 곧 정보다.** */
export const ELEMENT_LABEL: Record<ElementKey, string> = {
    water: '물',
    fire: '불',
    earth: '흙',
    wind: '바람',
}

/** 코드 → 키. **미등록 코드는 null** — 소비처는 중립 표기·플레이스홀더로 폴백한다. */
export function toElementKey(code: number): ElementKey | null {
    return ELEMENT_CODES.find((entry) => entry.code === code)?.key ?? null
}

/** 코드 → 표시 라벨. 미등록 코드는 코드 자체를 노출한다(무음 실패 방지). */
export function elementLabelOf(code: number): string {
    const key = toElementKey(code)
    return key ? ELEMENT_LABEL[key] : `속성 ${code}`
}

/**
 * 배지용 라벨 — **반드시 "속성"이라는 축 이름을 함께 낸다.**
 *
 * ★ 왜 `elementLabelOf` 로 충분하지 않은가: 색이 사라진 뒤 배지는 같은 회색 알약 여러 개다.
 *   그 안에 "물"·"도끼"만 적혀 있으면 어느 쪽이 속성이고 어느 쪽이 종류인지 **읽어서도 모른다**
 *   (게임을 모르는 사람에겐 "물"이 종류일 수도 있다). 축 이름을 붙이면 글자만으로 해석된다.
 */
export function elementBadgeLabelOf(code: number): string {
    const key = toElementKey(code)
    return key ? `${ELEMENT_LABEL[key]} 속성` : `속성 ${code}`
}
