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
    density?: 'regular' | 'compact' | 'preview'
    fullHeight?: boolean
    artwork?: ReactNode
    artworkOverlay?: ReactNode
    meta?: ReactNode
    trailing?: ReactNode
    footer?: ReactNode
    footerAction?: ReactNode
    action?: ReactNode
    hoverShadow?: 'default' | 'preview'
}

/** router·dialog·mutation·flip 상태를 모르는 순수 아이템 표시. */
export default function ItemCardView({
    item,
    density = 'regular',
    fullHeight = false,
    artwork,
    artworkOverlay,
    meta,
    trailing,
    footer,
    footerAction,
    action,
    hoverShadow = 'default',
}: ItemCardViewProps) {
    const compact = density === 'compact'
    const preview = density === 'preview'
    const elementNumber = elementNumberOf(item.element)
    const hoverShadowClass =
        hoverShadow === 'preview'
            ? 'hover:shadow-[var(--shadow-card-hover)]'
            : 'hover:shadow-md'

    return (
        <article
            className={`item-card flex flex-col overflow-hidden rounded-xl border border-content-line bg-content-surface transition-shadow ${hoverShadowClass} ${fullHeight ? 'h-full' : ''}`.trim()}
        >
            <div className="relative">
                {artwork ?? (
                    <ItemCardArtwork
                        item={item}
                        mode={preview ? 'preview' : 'card'}
                        overlay={artworkOverlay}
                    />
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
                        <div
                            data-listing-price
                            className="item-card__market-price min-w-0"
                        >
                            <CodeAmount
                                value={item.price.amount}
                                mode="full"
                                className="max-w-full min-w-0 flex-wrap break-all text-sm"
                            />
                        </div>
                    )}
                    {action}
                </div>
            ) : preview ? (
                <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                    {meta}
                    <h3 className="line-clamp-2 min-h-[2.6em] text-body font-bold leading-tight text-content-fg xs:text-sm">
                        {item.name}
                    </h3>
                    {item.price && (
                        <div
                            data-listing-price
                            className="mt-auto flex min-w-0 flex-wrap items-baseline gap-1.5 pt-1"
                        >
                            {item.price.label && (
                                <span className="text-label text-content-subtle">
                                    {item.price.label}
                                </span>
                            )}
                            <CodeAmount
                                value={item.price.amount}
                                mode="full"
                                className="max-w-full min-w-0 flex-wrap break-all text-body font-bold text-content-fg xs:text-sm"
                            />
                        </div>
                    )}
                    {trailing}
                    {action}
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
                        <div
                            data-listing-price
                            className="mt-auto flex min-w-0 flex-wrap items-baseline gap-1.5 pt-1"
                        >
                            {item.price.label && (
                                <span className="text-label text-content-subtle xs:text-xs">
                                    {item.price.label}
                                </span>
                            )}
                            <CodeAmount
                                value={item.price.amount}
                                mode="full"
                                className="max-w-full min-w-0 flex-wrap break-all text-body font-bold text-content-fg xs:text-sm"
                            />
                        </div>
                    )}
                    <ItemSkillList skills={item.skills} />
                    {action}
                </div>
            )}

            {footer ? (
                <div className="relative border-t border-content-line p-2">
                    {footer}
                    {footerAction}
                </div>
            ) : null}
        </article>
    )
}

export function ItemCardArtwork({
    item,
    overlay,
    mode = 'card',
}: {
    item: ItemCardViewModel
    overlay?: ReactNode
    mode?: 'card' | 'preview'
}) {
    const frame = (
        <ItemFrame
            showGoldforceDays
            fill={mode === 'preview'}
            className="item-card__artwork-frame"
            imageUrl={item.artUrl}
            spriteUrl={item.artUrl}
            name={item.name}
            visual={{ goldforceExpireAt: item.goldforceExpireAt }}
            hasSkill={item.skills.length > 0}
            size={mode === 'preview' ? 'stage' : undefined}
            now={item.referenceNow}
            overlay={overlay}
        />
    )

    return mode === 'preview' ? <div className="h-[158px]">{frame}</div> : frame
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
