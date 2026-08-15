import ItemFrame from '@/features/item/components/ItemFrame'
import { goldforceRemainingDays, resolveFrameType } from './frame'
import { resolveSkillSlots, skillLabelOf } from './skillSlots'
import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey, elementLabelOf } from '@/features/item/lib/element'
import { subGroupLabelOf } from '@/features/item/lib/itemCode'
import { channelLimitOf } from '@/features/item/lib/channelLimit'

export interface CardInfoContentProps {
    subGroup: number
    kind: number
    element: number
    level: number
    goldforceExpireAt: string | null
    name: string
    skill1: number | null
    skill2: number | null
    skillPercent: number
    skill1Name?: string | null
    skill2Name?: string | null
    now?: number
}

export default function CardInfoContent(props: CardInfoContentProps) {
    const referenceNow = props.now ?? Date.now()
    const frameLabel =
        resolveFrameType(
            { goldforceExpireAt: props.goldforceExpireAt },
            referenceNow,
        ) === 'GOLDFORCE'
            ? '골드'
            : '블랙'
    const channelLimit = channelLimitOf(props.level)
    const elementLabel = elementLabelOf(props.element)
    const elementKey = toElementKey(props.element)
    const goldforceDays = goldforceRemainingDays(
        props.goldforceExpireAt,
        referenceNow,
    )
    const art = itemArt(props, 'l', 2)
    const skills = resolveSkillSlots(props.skill1, props.skill2, {
        skill1Name: props.skill1Name,
        skill2Name: props.skill2Name,
    })
    const skillRows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: skills.find((skill) => skill.slot === slot),
    }))

    return (
        <>
            <div className="ci-head">
                <div className="ci-thumb">
                    <ItemFrame
                        fill
                        showGoldforceDays
                        size="stage"
                        imageUrl={art?.src}
                        spriteUrl={art?.src}
                        name={props.name}
                        visual={{ goldforceExpireAt: props.goldforceExpireAt }}
                        hasSkill={skills.length > 0}
                        now={props.now}
                        className="[--art-scale:2]"
                    />
                </div>
                <dl className="ci-attrs">
                    <InfoRow
                        label="타입"
                        value={`${frameLabel} - ${subGroupLabelOf(props.subGroup)}`}
                    />
                    <InfoRow label="명칭" value={props.name} />
                    <InfoRow label="채널제한" value={channelLimit} />
                    <InfoRow
                        label="속성"
                        value={elementLabel}
                        valueClass={elementKey ? `el-${elementKey}` : ''}
                    />
                    <InfoRow
                        label="남은 골드 포스"
                        value={goldforceDays ? `${goldforceDays}일` : '없음'}
                        valueClass={goldforceDays ? '' : 'gf-off'}
                    />
                </dl>
            </div>
            <div className="ci-panel">
                <h3>특수 스킬</h3>
                <ul className="skill-list" aria-label="특수 스킬">
                    {skillRows.map(({ slot, skill }) => (
                        <li key={slot}>
                            <span className="n">
                                <span className="sr-only">스킬 {slot}</span>
                                <span aria-hidden="true">{slot}</span>
                            </span>
                            <span>
                                {skill ? skillLabelOf(skill) : '-'}
                                {slot === 2 &&
                                    skill &&
                                    props.skillPercent > 0 && (
                                        <span className="pct">
                                            {' '}
                                            ({props.skillPercent}%)
                                        </span>
                                    )}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    )
}

function InfoRow({
    label,
    value,
    valueClass = '',
}: {
    label: string
    value: string
    valueClass?: string
}) {
    return (
        <div className="ci-row">
            <dt className="k">{label}</dt>
            <dd className={`v ${valueClass}`.trim()}>{value}</dd>
        </div>
    )
}
