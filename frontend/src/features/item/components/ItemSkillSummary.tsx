/**
 * ItemSkillSummary — 아이템 스킬 요약 (FC-068 → FC-099 스킬명 노출).
 *
 * ★ **표시 형식(사용자 확정, skill-exposure-spec §0)**: 두 줄 —
 *   · 스킬1 줄: `[skill1Name]`            (예: "공격시간 3 감소")
 *   · 스킬2 줄: `[skill2Name] [skillPercent]%`  (예: "트리플샷 33%")
 *   퍼센트는 **스킬2 줄에** 붙는다(발동확률은 활성 스킬=슬롯2에 관례로 묶는다, §2.4·§6). 슬롯2가
 *   없으면(스킬1만 보유) %를 싣지 않는다. 두 슬롯은 항상 표시하고 누락값은 `없음`으로 낸다.
 * ★ **스킬명은 계약 §3.3 델타(skill1Name·skill2Name)로 모든 item 블록에 실린다**(EPIC-MARKET-DATA).
 *   이름이 null 이면(미등록·마법 스킬1 부재) `스킬 #{code}` 중립 표기로 폴백한다(폴백 의무).
 * ★ 슬롯 번호 해소·중립 표기는 순수 함수 `skillSlots.ts` 에 있다(슬롯 오표기 방지 로직).
 */
import { resolveSkillSlots, skillLabelOf } from './skillSlots'

interface ItemSkillSummaryProps {
    skill1: number | null | undefined
    skill2: number | null | undefined
    /** 슬롯1 스킬명(계약 §3.3). 없으면 중립 표기 폴백 */
    skill1Name?: string | null
    /** 슬롯2 스킬명(계약 §3.3). 없으면 중립 표기 폴백 */
    skill2Name?: string | null
    /** 스킬2 줄에 붙는 발동확률(%). 0 이하·부재면 생략(사용자 확정 형식) */
    skillPercent?: number | null
    className?: string
}

function ItemSkillSummary({
    skill1,
    skill2,
    skill1Name,
    skill2Name,
    skillPercent,
    className = '',
}: ItemSkillSummaryProps) {
    const slots = resolveSkillSlots(skill1, skill2, { skill1Name, skill2Name })
    const rows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: slots.find((skill) => skill.slot === slot),
    }))

    return (
        <ul
            className={`grid grid-rows-2 gap-0.5 ${className}`.trim()}
            aria-label="스킬"
        >
            {rows.map(({ slot, skill }) => {
                const value = skill ? skillLabelOf(skill) : '없음'
                // 발동확률은 슬롯2 줄에만(사용자 확정 형식). 0·부재면 생략.
                const showPercent =
                    slot === 2 &&
                    skill !== undefined &&
                    skillPercent !== null &&
                    skillPercent !== undefined &&
                    skillPercent > 0

                return (
                    <li
                        key={slot}
                        aria-label={`스킬 ${slot} ${value}${showPercent ? `(${skillPercent}%)` : ''}`}
                        className="flex min-h-0 min-w-0 items-center text-[11px] font-medium xs:text-xs"
                    >
                        <span className="item-skill-summary__slot shrink-0">
                            스킬 {slot}
                        </span>{' '}
                        <span className="item-skill-summary__value item-skill-content flex min-w-0 flex-1 items-center">
                            <span className="item-skill-summary__name min-w-0 truncate">
                                {value}
                            </span>
                            {showPercent && (
                                <span className="item-skill-summary__percent shrink-0 font-bold">
                                    ({skillPercent}%)
                                </span>
                            )}
                        </span>
                    </li>
                )
            })}
        </ul>
    )
}

export default ItemSkillSummary
