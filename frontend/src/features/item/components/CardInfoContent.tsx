import ItemFrame from '@/features/item/components/ItemFrame'
import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey } from '@/features/item/lib/element'
import type { CardInfoResponse } from '@/lib/api/cardInfo'
import './CardInfoDialog.css'

export interface CardInfoContentProps {
    subGroup: number
    kind: number
    element: number
    level: number
    cardInfo: CardInfoResponse
}

export default function CardInfoContent({
    cardInfo,
    ...axes
}: CardInfoContentProps) {
    const elementKey = toElementKey(cardInfo.element.code)
    const art = itemArt(axes, 'l', 2)

    return (
        <div className="card-info-content">
            <div className="ci-head">
                <div className="ci-thumb">
                    <ItemFrame
                        fill
                        showGoldforceDays
                        size="stage"
                        imageUrl={art?.src}
                        spriteUrl={art?.src}
                        name={cardInfo.shortName}
                        frame={cardInfo.frame}
                        hasSkill={cardInfo.skills.some(
                            (skill) => skill.code !== null,
                        )}
                        className="[--art-scale:2]"
                    />
                </div>
                <dl className="ci-attrs">
                    <InfoRow
                        label="타입"
                        value={`${cardInfo.frame.label} - ${cardInfo.category.label}`}
                    />
                    <InfoRow label="명칭" value={cardInfo.formalName} />
                    <InfoRow
                        label="채널제한"
                        value={cardInfo.channelLimit.label}
                    />
                    <InfoRow
                        label="속성"
                        value={cardInfo.element.label}
                        valueClass={elementKey ? `el-${elementKey}` : ''}
                    />
                    <InfoRow
                        label="남은 골드 포스"
                        value={String(cardInfo.frame.remainingGoldforceDays)}
                        valueClass={
                            cardInfo.frame.type === 'BLACK' ? 'gf-off' : ''
                        }
                    />
                </dl>
            </div>
            <div className="ci-panel">
                <h3>특수 스킬</h3>
                <ul className="skill-list" aria-label="특수 스킬">
                    {cardInfo.skills.map((skill) => (
                        <li key={skill.slot}>
                            <span className="n">
                                <span className="sr-only">
                                    스킬 {skill.slot}
                                </span>
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
        </div>
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
