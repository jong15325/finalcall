/**
 * ItemSkillSummary — 아이템 스킬 요약 (FC-068).
 *
 * ★ **경매 맥락은 스킬 이름이 없다**(item 블록은 정수 코드만, §2.5). 그때는 `스킬 #{code}` 중립
 *   표기로 흘린다(계약 §3.3 폴백 의무). 이름은 **아이템 인스턴스 상세**(`GET /items/{id}`)에서만
 *   내려오므로, 그 맥락에서만 `skill1Name`/`skill2Name` 을 주입한다.
 * ★ 슬롯 번호 해소·중립 표기는 순수 함수 `skillSlots.ts` 에 있다(슬롯 오표기 방지 로직).
 */
import { resolveSkillSlots, skillLabelOf } from './skillSlots'

interface ItemSkillSummaryProps {
    skill1: number | null | undefined
    skill2: number | null | undefined
    /** 인스턴스 상세 맥락에서만 주입(경매 맥락은 생략 → 중립 표기) */
    skill1Name?: string | null
    skill2Name?: string | null
    /** 스킬이 하나도 없을 때 표기(행 높이 통일용). 기본 "스킬 없음" */
    emptyLabel?: string
    className?: string
}

function ItemSkillSummary({
    skill1,
    skill2,
    skill1Name,
    skill2Name,
    emptyLabel = '스킬 없음',
    className = '',
}: ItemSkillSummaryProps) {
    const slots = resolveSkillSlots(skill1, skill2, { skill1Name, skill2Name })

    if (slots.length === 0) {
        return (
            <p
                className={`text-[11px] text-gray-400 xs:text-xs ${className}`.trim()}
            >
                {emptyLabel}
            </p>
        )
    }

    return (
        <ul
            className={`flex flex-wrap gap-1 ${className}`.trim()}
            aria-label="스킬"
        >
            {slots.map((skill) => (
                <li
                    key={skill.slot}
                    className="rounded bg-navy/5 px-1.5 py-0.5 text-[11px] font-medium text-navy-700 xs:text-xs"
                >
                    {skillLabelOf(skill)}
                </li>
            ))}
        </ul>
    )
}

export default ItemSkillSummary
