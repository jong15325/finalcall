import ItemFrame from '@/features/item/components/ItemFrame'
import { itemArt } from '@/features/item/lib/itemArt'
import { toElementKey } from '@/features/item/lib/element'
import type { CardInfoResponse } from '@/lib/api/cardInfo'
import CardInfoSkillPanel from './CardInfoSkillPanel'
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
            <CardInfoSkillPanel skills={cardInfo.skills} />
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
