import ItemFrame from '@/features/item/components/ItemFrame'
import { goldforceRemainingDays } from '@/features/item/components/frame'
import {
    resolveSkillSlots,
    skillLabelOf,
} from '@/features/item/components/skillSlots'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import { shopStatusLabelOf } from '@/features/shop/lib/shopStatus'
import type { ShopDetail } from '@/lib/api/shop'

/**
 * 고정가 상세 히어로 카드 (FC-094 — 경매 `AuctionHeroCard` 를 고정가로 변형).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **경매 상세의 승인된 디자인을 재사용**한다 — 아트 스테이지 + 아이템 표시 공용부(§3.1).
 * ══════════════════════════════════════════════════════════════════════════════
 * 경매와 다른 점은 **상단 배지가 phase 가 아니라 고정가 상태**(판매 중/완료/만료/취소)라는 것뿐.
 * 입찰·카운트다운·최고가 요소는 이 카드에 없다(우측 `ShopBuyPanel` 도 마찬가지).
 *
 * ★ **스킬명은 item 블록의 skill1Name/skill2Name 으로 표시**(계약 §3.3 델타 — EPIC-MARKET-DATA).
 *   이름이 없으면 `스킬 #{code}` 중립 표기로 폴백. 슬롯은 `resolveSkillSlots` 가 매겨 마법(subGroup 3,
 *   skill1 부재) 오표기를 막는다. 발동확률은 슬롯2 값이 있을 때 해당 행에 함께 표시한다.
 * ★ **골드포스 잔여일은 클라 파생**(서버는 만료 시각만). 색은 브랜드 팔레트(navy/gold).
 */

const STATUS_BADGE_CLASS: Record<string, string> = {
    ACTIVE: 'bg-success-soft text-success-ink',
    SOLD: 'bg-content-soft text-content-subtle',
    EXPIRED: 'bg-content-soft text-content-subtle',
    CANCELLED: 'bg-content-soft text-content-subtle',
}

interface ShopHeroCardProps {
    shop: ShopDetail
    /** 현재 시각(ms) — 골드포스 잔여일 파생용(단일 타이머 주입) */
    now: number
}

function ShopHeroCard({ shop, now }: ShopHeroCardProps) {
    const { item } = shop
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        3,
    )
    const skills = resolveSkillSlots(item.skill1, item.skill2, {
        skill1Name: item.skill1Name,
        skill2Name: item.skill2Name,
    })
    const skillRows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: skills.find((skill) => skill.slot === slot),
    }))
    const hasSkill = skills.length > 0
    const goldforceDays = goldforceRemainingDays(item.goldforceExpireAt, now)
    const badgeClass =
        STATUS_BADGE_CLASS[shop.status] ?? 'bg-content-soft text-content-subtle'

    return (
        <section className="grid overflow-hidden rounded-2xl border border-content-line bg-content-surface md:grid-cols-[118px_minmax(0,1fr)] lg:grid-cols-[245px_minmax(0,1fr)]">
            {/* 아트 열 — 스프라이트 스테이지가 열 전체를 채우고 프레임을 가운데. lg 2배 확대(§3·§5). */}
            <div className="relative min-h-[220px] lg:min-h-[390px]">
                <ItemFrame
                    fill
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.nameSnapshot}
                    visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                    hasSkill={hasSkill}
                    size="stage"
                    now={now}
                    className="lg:[--art-scale:2]"
                />
            </div>

            {/* copy 열 */}
            <div className="flex flex-col p-5 lg:p-9">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}
                    >
                        {shopStatusLabelOf(shop.status)}
                    </span>
                    <span className="rounded-full bg-brand-structure/10 px-2.5 py-1 text-[11px] font-bold text-chrome-selected">
                        고정가
                    </span>
                    {goldforceDays !== null && (
                        <span className="rounded-full bg-brand-highlight-soft px-2.5 py-1 text-[11px] font-bold text-brand-highlight-deep">
                            골드포스 {goldforceDays}일 남음
                        </span>
                    )}
                </div>

                <h2 className="mt-4 text-xl font-bold leading-tight text-content-fg lg:text-2xl">
                    {item.nameSnapshot}
                </h2>
                <p className="mt-2 text-sm text-content-subtle">
                    {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
                    {elementBadgeLabelOf(item.element)} · Lv.{item.level}
                </p>

                <p className="my-5 rounded-lg bg-content-soft p-3.5 text-sm text-content-muted">
                    {item.specSnapshot}
                </p>

                <dl className="mt-auto">
                    {skillRows.map(({ slot, skill }) => (
                        <div
                            key={slot}
                            className="flex h-10 min-w-0 items-center justify-between gap-3 border-b border-content-line text-sm"
                        >
                            <dt className="item-skill-label shrink-0 font-medium">
                                스킬 {slot}
                            </dt>
                            <dd className="item-skill-content min-w-0 truncate font-semibold">
                                {skill ? skillLabelOf(skill) : '-'}
                                {slot === 2 &&
                                    skill &&
                                    item.skillPercent > 0 && (
                                        <span className="item-skill-percent">
                                            ({item.skillPercent}%)
                                        </span>
                                    )}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    )
}

export default ShopHeroCard
