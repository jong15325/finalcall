import { ELEMENT_CODES } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
import { SUB_GROUPS, kindsOf } from '@/features/item/lib/itemCode'
import type { ItemTemplate } from '@/lib/api/itemTemplates'

/**
 * 필터 선택지 구성 (계약 §4.1 카탈로그 + §3.3.1 코드 사전) — FC-071.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **선택지의 정본은 로컬 코드 사전이고, 카탈로그는 "없는 것을 숨기는" 향상일 뿐이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `item-templates`(§4.1)가 로딩·실패여도 필터는 완전히 동작해야 한다 — 백엔드 부재가 곧
 * 필터 마비가 되면 안 된다. 그래서 카탈로그가 **비어 있으면 전체 사전을 그대로 노출**(폴백)하고,
 * 값이 있으면 그중 **실제 존재하는 코드만** 남긴다. 존재하지도 않는 조합의 필터를 눌러
 * "결과 없음"만 보게 되는 헛걸음(§4.1 성립 불가 조합)을 줄인다.
 *
 * ★ `kind` 는 **`subGroup` 종속**이라 단독 함수를 두지 않는다 — 항상 `subGroup` 을 함께 받는다
 *   (`itemCode.ts` 와 같은 태도). subGroup 미선택(null)이면 빈 배열 → UI 가 비활성으로 표시한다.
 */

export interface CodeOption {
    code: number
    label: string
}

/** 카탈로그에 존재하는 subGroup 코드 집합. 비면(로딩/실패) null 로 "폴백하라" 를 알린다. */
function presentSubGroups(
    templates: readonly ItemTemplate[],
): Set<number> | null {
    if (templates.length === 0) return null
    return new Set(templates.map((template) => template.subGroup))
}

/** 카탈로그에 존재하는 element 코드 집합. 비면 null(폴백). */
function presentElements(
    templates: readonly ItemTemplate[],
): Set<number> | null {
    if (templates.length === 0) return null
    return new Set(templates.map((template) => template.element))
}

/**
 * 대분류 선택지. 카탈로그가 있으면 그 안에 존재하는 대분류만, 없으면 사전 전체(폴백).
 * 순서는 사전 순서(무기→방어구→마법)를 유지한다.
 */
export function subGroupOptions(
    templates: readonly ItemTemplate[] = [],
): CodeOption[] {
    const present = presentSubGroups(templates)
    return SUB_GROUPS.filter(
        (entry) => present === null || present.has(entry.code),
    ).map((entry) => ({ code: entry.code, label: entry.label }))
}

/**
 * 속성 선택지. `ElementKey` 대신 코드+라벨로 낸다(색이 없어 라벨이 유일 채널, `element.ts`).
 */
export function elementOptions(
    templates: readonly ItemTemplate[] = [],
): { code: number; key: ElementKey }[] {
    const present = presentElements(templates)
    return ELEMENT_CODES.filter(
        (entry) => present === null || present.has(entry.code),
    ).map((entry) => ({ code: entry.code, key: entry.key }))
}

/**
 * 종류 선택지 — **반드시 `subGroup` 종속**. subGroup 이 null 이면 빈 배열(UI 비활성 신호).
 * 카탈로그가 있으면 그 대분류 안에 실제 존재하는 종류만 남긴다(마법의 없는 kind 3·4 제거).
 */
export function kindOptions(
    subGroup: number | null,
    templates: readonly ItemTemplate[] = [],
): CodeOption[] {
    if (subGroup === null) return []

    const dictionary = kindsOf(subGroup)
    if (dictionary.length === 0) return []

    if (templates.length === 0) {
        return dictionary.map((entry) => ({
            code: entry.code,
            label: entry.label,
        }))
    }

    const present = new Set(
        templates
            .filter((template) => template.subGroup === subGroup)
            .map((template) => template.kind),
    )
    return dictionary
        .filter((entry) => present.has(entry.code))
        .map((entry) => ({ code: entry.code, label: entry.label }))
}
