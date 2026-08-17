import type { ReactNode } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import { channelLimitOf } from '@/features/item/lib/channelLimit'
import { elementLabelOf } from '@/features/item/lib/element'
import type { ElementKey } from '@/features/item/lib/element'
import { goldforceRemainingDays } from './frame'
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
                        className="item-card__market-skills"
                        skills={item.skills}
                    />
                    {item.price && (
                        <div
                            data-listing-price
                            className="item-card__market-price min-w-0"
                        >
                            {item.price.label && (
                                <span className="mb-1 block text-label font-medium text-content-muted">
                                    {item.price.label}
                                </span>
                            )}
                            <CodeAmount
                                value={item.price.amount}
                                mode="full"
                                className="max-w-full min-w-0 flex-wrap break-all text-sm"
                            />
                        </div>
                    )}
                    {trailing}
                    {item.seller && (
                        <p
                            className="item-card__seller-row min-w-0 text-label text-content-subtle xs:text-xs"
                            title={`판매자 ${item.seller}`}
                        >
                            <span>판매자</span>
                            <strong className="min-w-0 truncate">
                                {item.seller}
                            </strong>
                        </p>
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
    mode?: 'card' | 'preview' | 'fill'
}) {
    const frame = (
        <ItemFrame
            showGoldforceDays
            fill={mode !== 'card'}
            className="item-card__artwork-frame"
            imageUrl={item.artUrl}
            spriteUrl={item.artUrl}
            name={item.name}
            visual={{ goldforceExpireAt: item.goldforceExpireAt }}
            hasSkill={item.skills.length > 0}
            size={mode === 'card' ? undefined : 'stage'}
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
                className="item-card__skill-list"
                skills={item.skills}
            />
        </div>
    )
}

export function ItemCardPropertyBackView({
    item,
}: {
    item: ItemCardViewModel
}) {
    const goldforceDays = goldforceRemainingDays(
        item.goldforceExpireAt,
        item.referenceNow,
    )
    const rows = [
        ['타입', item.typeLabel],
        ['명칭', item.name],
        ['채널제한', channelLimitOf(item.level)],
        ['속성', elementLabelOf(elementNumberOf(item.element))],
        [
            '남은 골드 포스',
            goldforceDays === null ? '없음' : `${goldforceDays}일`,
        ],
    ] as const

    return (
        <dl className="item-card__property-table">
            {rows.map(([label, value]) => (
                <div key={label} className="item-card__property-row">
                    <dt>{label}</dt>
                    <dd title={value}>{value}</dd>
                </div>
            ))}
        </dl>
    )
}

function ItemSkillList({
    skills,
    className = '',
}: {
    skills: readonly ItemSkillView[]
    className?: string
}) {
    const rows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: skills.find((skill) => skill.slot === slot),
    }))

    return (
        <ul
            aria-label="스킬"
            className={`item-card__skill-rows ${className}`.trim()}
        >
            {rows.map(({ slot, skill }) => (
                <li
                    key={slot}
                    className="item-card__skill-row text-label font-medium text-brand-structure xs:text-xs"
                >
                    <span className="item-skill-summary__slot">
                        스킬 {slot}
                    </span>{' '}
                    {skill?.label ?? '-'}
                    {skill?.percent ? (
                        <span className="item-card__skill-percent ml-1 font-bold text-control-action-hover">
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
