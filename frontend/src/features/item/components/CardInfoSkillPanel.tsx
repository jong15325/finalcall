import type { CardInfoSkill } from '@/lib/api/cardInfo'
import './CardInfoDialog.css'

interface CardInfoSkillPanelProps {
    skills: readonly CardInfoSkill[]
}

/** 카드정보 표면에서 사용하는 특수스킬 1·2번 슬롯 정본. */
export default function CardInfoSkillPanel({
    skills,
}: CardInfoSkillPanelProps) {
    return (
        <div className="ci-panel">
            <h3>특수 스킬</h3>
            <ul className="skill-list" aria-label="특수 스킬">
                {skills.map((skill) => (
                    <li key={skill.slot}>
                        <span className="n">
                            <span className="sr-only">스킬 {skill.slot}</span>
                            <span aria-hidden="true">{skill.slot}</span>
                        </span>
                        <span>
                            {skill.name ?? '-'}
                            {skill.percent !== null && (
                                <span className="pct">
                                    {' '}
                                    ({skill.percent}%)
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
