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
 * ★ **스킬은 코드만**(item 블록엔 이름 없음, §2.5) → `스킬 #{code}` 중립 표기. 슬롯은
 *   `resolveSkillSlots` 가 매겨 마법(subGroup 3, skill1 부재) 오표기를 막는다.
 * ★ **골드포스 잔여일은 클라 파생**(서버는 만료 시각만). 색은 브랜드 팔레트(navy/gold).
 */

const STATUS_BADGE_CLASS: Record<string, string> = {
    ACTIVE: 'bg-success-subtle text-success',
    SOLD: 'bg-gray-100 text-gray-500',
    EXPIRED: 'bg-gray-100 text-gray-500',
    CANCELLED: 'bg-gray-100 text-gray-500',
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
    const skills = resolveSkillSlots(item.skill1, item.skill2)
    const hasSkill = skills.length > 0
    const goldforceDays = goldforceRemainingDays(item.goldforceExpireAt, now)
    const badgeClass =
        STATUS_BADGE_CLASS[shop.status] ?? 'bg-gray-100 text-gray-500'

    return (
        <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[118px_minmax(0,1fr)] lg:grid-cols-[245px_minmax(0,1fr)]">
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
                    <span className="rounded-full bg-navy/10 px-2.5 py-1 text-[11px] font-bold text-navy-700">
                        고정가
                    </span>
                    {goldforceDays !== null && (
                        <span className="rounded-full bg-gold-subtle px-2.5 py-1 text-[11px] font-bold text-gold-deep">
                            골드포스 {goldforceDays}일 남음
                        </span>
                    )}
                </div>

                <h2 className="mt-4 text-xl font-bold leading-tight text-gray-900 lg:text-2xl">
                    {item.nameSnapshot}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
                    {elementBadgeLabelOf(item.element)} · Lv.{item.level}
                </p>

                <p className="my-5 rounded-lg bg-surface-sunken p-3.5 text-sm text-gray-600">
                    {item.specSnapshot}
                </p>

                <dl className="mt-auto">
                    {skills.map((skill) => (
                        <div
                            key={skill.slot}
                            className="flex items-center justify-between border-b border-line py-2.5 text-sm"
                        >
                            <dt className="font-medium text-gray-500">
                                스킬 {skill.slot}
                            </dt>
                            <dd className="font-semibold text-gray-900">
                                {skillLabelOf(skill)}
                            </dd>
                        </div>
                    ))}
                    {item.skillPercent > 0 && (
                        <div className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                            <dt className="font-medium text-gray-500">
                                발동 확률
                            </dt>
                            <dd className="font-semibold text-gray-900">
                                +{item.skillPercent}%
                            </dd>
                        </div>
                    )}
                    {skills.length === 0 && item.skillPercent <= 0 && (
                        <div className="py-2.5 text-sm text-gray-400">
                            스킬 없음
                        </div>
                    )}
                </dl>
            </div>
        </section>
    )
}

export default ShopHeroCard
