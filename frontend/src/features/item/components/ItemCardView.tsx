import type { ReactNode } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import { elementLabelOf } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
import ItemFrame from './ItemFrame'

export interface ItemSkillView {
    slot: 1 | 2
    label: string
    percent?: number | null
}

export interface ItemCardViewModel {
    name: string
    description?: string
    typeLabel: string
    kindLabel: string
    level: number
    element: ElementKey | null
    artUrl: string | null
    skills: readonly ItemSkillView[]
    price?: { amount: number | null; label?: string }
    seller?: string
    goldforceExpireAt?: string | null
    referenceNow: number
}

export interface ItemCardViewProps {
    item: ItemCardViewModel
    density?: 'regular' | 'compact'
    artwork?: ReactNode
    artworkOverlay?: ReactNode
    badge?: ReactNode
    footer?: ReactNode
}

/** router·dialog·mutation·flip 상태를 모르는 순수 아이템 표시. */
export default function ItemCardView({
    item,
    density = 'regular',
    artwork,
    artworkOverlay,
    badge,
    footer,
}: ItemCardViewProps) {
    const compact = density === 'compact'
    const elementNumber = elementNumberOf(item.element)

    return (
        <article className="item-card flex h-full flex-col overflow-hidden rounded-xl border border-content-line bg-content-surface transition-shadow hover:shadow-md">
            <div className="relative">
                {artwork ?? (
                    <ItemCardArtwork
                        item={item}
                        overlay={artworkOverlay}
                    />
                )}
                {badge && (
                    <div className="absolute left-1.5 top-1.5">{badge}</div>
                )}
            </div>

            {compact ? (
                <div className="item-card__market-info flex flex-1 flex-col p-3">
                    <div className="item-card__market-heading">
                        <h3>{item.typeLabel}</h3>
                        <span
                            className={`item-card__element-badge element-${elementNumber}`}
                        >
                            {elementLabelOf(elementNumber)}
                        </span>
                    </div>
                    <p>
                        {item.kindLabel} · Lv.{item.level}
                    </p>
                    <ItemSkillList
                        showSlotLabels
                        className="item-card__market-skills"
                        skills={item.skills}
                    />
                    {item.price && (
                        <div className="item-card__market-price">
                            <CodeAmount
                                value={item.price.amount}
                                mode="compact"
                            />
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <h3 className="line-clamp-2 min-h-[2.6em] text-body font-bold leading-tight text-content-fg xs:text-sm">
                        {item.name}
                    </h3>
                    <p className="truncate text-label text-content-subtle xs:text-xs">
                        {item.description || ' '}
                    </p>
                    {item.price && (
                        <div className="mt-auto flex items-baseline gap-1.5 whitespace-nowrap pt-1">
                            {item.price.label && (
                                <span className="text-label text-content-subtle xs:text-xs">
                                    {item.price.label}
                                </span>
                            )}
                            <CodeAmount
                                value={item.price.amount}
                                mode="compact"
                                className="text-body font-bold text-content-fg xs:text-sm"
                            />
                        </div>
                    )}
                    <ItemSkillList skills={item.skills} />
                </div>
            )}

            {footer ? (
                <div className="border-t border-content-line p-2">{footer}</div>
            ) : null}
        </article>
    )
}

export function ItemCardArtwork({
    item,
    overlay,
}: {
    item: ItemCardViewModel
    overlay?: ReactNode
}) {
    return (
        <ItemFrame
            showGoldforceDays
            imageUrl={item.artUrl}
            spriteUrl={item.artUrl}
            name={item.name}
            visual={{ goldforceExpireAt: item.goldforceExpireAt }}
            hasSkill={item.skills.length > 0}
            now={item.referenceNow}
            overlay={overlay}
        />
    )
}

export function ItemCardBackView({ item }: { item: ItemCardViewModel }) {
    return (
        <div className="flex h-full flex-col">
            <strong>{item.typeLabel}</strong>
            <span className="item-card__skill-name">
                {item.kindLabel} · Lv.{item.level}
            </span>
            <ItemSkillList
                showSlotLabels
                className="item-card__skill-list"
                skills={item.skills}
            />
            {item.seller && (
                <small>
                    판매자 <b>{item.seller}</b>
                </small>
            )}
        </div>
    )
}

function ItemSkillList({
    skills,
    showSlotLabels = false,
    className = '',
}: {
    skills: readonly ItemSkillView[]
    showSlotLabels?: boolean
    className?: string
}) {
    if (skills.length === 0) {
        return (
            <p
                className={`text-label text-content-subtle xs:text-xs ${className}`}
            >
                스킬 없음
            </p>
        )
    }

    return (
        <ul
            aria-label="스킬"
            className={`flex flex-col gap-0.5 ${className}`.trim()}
        >
            {skills.map((skill) => (
                <li
                    key={skill.slot}
                    className="truncate text-label font-medium text-brand-structure xs:text-xs"
                >
                    {showSlotLabels && (
                        <span className="item-skill-summary__slot">
                            스킬 {skill.slot}
                        </span>
                    )}{' '}
                    {skill.label}
                    {skill.percent ? (
                        <span className="ml-1 font-bold text-control-action-hover">
                            {skill.percent}%
                        </span>
                    ) : null}
                </li>
            ))}
        </ul>
    )
}

function elementNumberOf(element: ElementKey | null) {
    if (element === 'water') return 1
    if (element === 'fire') return 2
    if (element === 'earth') return 3
    if (element === 'wind') return 4
    return 0
}
