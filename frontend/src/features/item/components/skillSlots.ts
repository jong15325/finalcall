/**
 * 스킬 슬롯 해소 (FC-068 — rebuild-contract-map §2.5·§3.3).
 *
 * ★ **슬롯 번호를 먼저 매기고 걸러라.** `skill1`→슬롯1, `skill2`→슬롯2 로 위치를 고정한 뒤 null 을
 *   제거한다. 그래서 마법(subGroup 3, `skill1` 구조적 부재)은 `skill2` 가 **슬롯 2 그대로** 남고,
 *   결코 "슬롯 1" 로 재번호되지 않는다(오표기 금지). `<ItemSkillSummary>` 와 분리한 순수 함수다
 *   (테스트·재사용·fast-refresh 안정 — `codeFormat.ts` 와 같은 태도).
 */

export interface ResolvedSkill {
    /** 위치 슬롯(1 또는 2). null 제거 후에도 재번호하지 않는다 */
    slot: 1 | 2
    code: number
    /** 인스턴스 상세에서만 존재. 경매 맥락은 null → `스킬 #{code}` 중립 표기 */
    name: string | null
}

export interface SkillNames {
    skill1Name?: string | null
    skill2Name?: string | null
}

/** 슬롯 번호를 먼저 매기고 null 을 거른다(위 ★). */
export function resolveSkillSlots(
    skill1: number | null | undefined,
    skill2: number | null | undefined,
    names?: SkillNames,
): ResolvedSkill[] {
    const positioned: {
        slot: 1 | 2
        code: number | null | undefined
        name: string | null
    }[] = [
        { slot: 1, code: skill1, name: names?.skill1Name ?? null },
        { slot: 2, code: skill2, name: names?.skill2Name ?? null },
    ]

    return positioned.filter(
        (entry): entry is ResolvedSkill =>
            entry.code !== null &&
            entry.code !== undefined &&
            Number.isFinite(entry.code),
    )
}

/** 슬롯 표시 라벨 — 이름이 있으면 이름, 없으면 중립 코드 표기. */
export function skillLabelOf(skill: ResolvedSkill): string {
    return skill.name ?? `스킬 #${skill.code}`
}
