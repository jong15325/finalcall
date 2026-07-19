/**
 * 아이템 코드 사전 — **정본은 계약 v1.10 §3.3.1**(게이트2 FC-044 승인). FC-058 이식.
 *
 * ★ **`kind` 는 `subGroup` 에 종속된 축이다.** 같은 숫자가 대분류마다 다른 것을 가리킨다 —
 * `kind=1` 은 무기에서 도끼, 방어구에서 방패, 마법에서 일반이다. 계약 §4.1 이 이를 명문화하며
 * "서버는 400 으로 막지 않는다 — **다의성 해소는 클라이언트 책임**"이라 못 박았다.
 * 그래서 이 모듈은 `kind` 를 단독 표로 내보내지 않는다. **항상 `subGroup` 을 함께 받는 함수**만 있다.
 * (표를 하나로 합치면 소비처가 `KIND_LABEL[kind]` 를 쓰게 되고, 그 순간 다의성이 화면에 샌다.)
 *
 * ★ 폴백 의무(계약 §3.3): 사전에 없는 코드는 중립 표기로 흘리고, 코드 집합 크기를 가정한
 * 하드코딩(배열 인덱싱·exhaustive switch)을 두지 않는다. `element.ts` 와 같은 태도다.
 *
 * ★ 표시명(한국어)은 **UX 재량**이며 계약 변경 대상이 아니다(§3.3.1 주). 실제 화면 표기는
 * `item.nameSnapshot`·`specSnapshot`(등록 시점 스냅샷, D-045)이 우선하고, 이 사전은
 * **필터·배지·아트 매핑용 코드 해석**에 쓴다.
 */

/**
 * `typeCode` 4자리 자리값 분해 (계약 v1.10 §3.3.1).
 *
 * ```
 * typeCode = mainCategory×1000 + subGroup×100 + element×10 + kind
 * ```
 *
 * ★ **왜 필요한가** — 목록/상세의 `item` 블록(§3.3)은 4축을 개별 필드로 내려주지만,
 * **인벤토리·임시보관의 `summary`(§4.2)는 `typeCode` 하나만 싣는다.** 축이 없으면 아트 경로도
 * 속성 배지도 만들 수 없다. 계약이 산식을 정본으로 못 박았으므로 클라이언트가 분해한다 —
 * 서버에 필드 추가를 요구할 사안이 아니다(§3.3.1이 "코드 변환 계층 없음"을 명시).
 *
 * ★ **스코프는 `mainCategory = 1`(아이템 카드) 대역뿐이다**(§3.3.1). 다른 상품군(2~6)은 이 산식을
 * 따르지 않는 평면 SKU 라 분해 결과가 무의미하다. 여기서 예외를 던져 화면을 막지 않는다 —
 * 소비처(`itemArt`·`element`)가 미등록 코드를 플레이스홀더·중립 표기로 폴백한다.
 */
export interface TypeCodeAxes {
    mainCategory: number
    subGroup: number
    element: number
    kind: number
}

export function decodeTypeCode(typeCode: number): TypeCodeAxes {
    const value = Number.isFinite(typeCode) ? Math.trunc(typeCode) : 0
    return {
        mainCategory: Math.floor(value / 1000),
        subGroup: Math.floor(value / 100) % 10,
        element: Math.floor(value / 10) % 10,
        kind: value % 10,
    }
}

/** 대분류(계약 §3.3.1 `subGroup`). 이 목록이 필터 칩의 표시 순서이기도 하다. */
export const SUB_GROUPS: readonly { code: number; label: string }[] = [
    { code: 1, label: '무기' },
    { code: 2, label: '방어구' },
    { code: 3, label: '마법' },
]

/**
 * 대분류별 종류 표. **무기·방어구는 4종, 마법은 2종뿐이다** —
 * `subGroup=3 & kind>=3` 은 성립 불가 조합이며 서버가 그런 템플릿을 갖지 않는다(§3.3.1).
 *
 * `art` 는 카드 아트 파일명이다. **마법 2종은 `magic.png` 한 장을 공유한다**(2:1) —
 * 원본 아트에 특수/일반 구분이 없다.
 */
const KINDS_BY_SUB_GROUP: Record<
    number,
    readonly { code: number; label: string; art: string }[]
> = {
    1: [
        { code: 1, label: '도끼', art: 'axe' },
        { code: 2, label: '완드', art: 'wand' },
        { code: 3, label: '검', art: 'sword' },
        { code: 4, label: '활', art: 'bow' },
    ],
    2: [
        { code: 1, label: '방패', art: 'shield' },
        { code: 2, label: '펜던트', art: 'pendant' },
        { code: 3, label: '갑옷', art: 'armor' },
        { code: 4, label: '신발', art: 'boots' },
    ],
    3: [
        { code: 1, label: '일반', art: 'magic' },
        { code: 2, label: '특수', art: 'magic' },
    ],
}

/** 대분류 표시명. 미등록 코드는 코드를 노출한다(무음 실패 방지). */
export function subGroupLabelOf(subGroup: number): string {
    return (
        SUB_GROUPS.find((entry) => entry.code === subGroup)?.label ??
        `대분류 ${subGroup}`
    )
}

/** 대분류에 속한 종류 목록. 미등록 대분류는 빈 배열 — 필터가 선택지를 지어내지 않는다. */
export function kindsOf(
    subGroup: number,
): readonly { code: number; label: string }[] {
    return KINDS_BY_SUB_GROUP[subGroup] ?? []
}

/** 종류 표시명. **반드시 대분류와 함께** 해석한다(위 ★). */
export function kindLabelOf(subGroup: number, kind: number): string {
    return (
        kindsOf(subGroup).find((entry) => entry.code === kind)?.label ??
        `종류 ${kind}`
    )
}

/** 아트 파일명 조각. 미등록 조합은 null — 소비처는 플레이스홀더로 폴백한다. */
export function kindArtSlugOf(subGroup: number, kind: number): string | null {
    return (
        KINDS_BY_SUB_GROUP[subGroup]?.find((entry) => entry.code === kind)
            ?.art ?? null
    )
}

/** "무기 · 검" 형태의 타입 한 줄. 카드 부제·상세 정체성 스트립이 함께 쓴다. */
export function itemTypeLabel(subGroup: number, kind: number): string {
    return `${subGroupLabelOf(subGroup)} · ${kindLabelOf(subGroup, kind)}`
}
