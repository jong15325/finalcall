import ItemFrame from '@/features/item/components/ItemFrame'
import { itemArt } from '@/features/item/lib/itemArt'
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
 * ★ 명칭·종류·속성·스킬·골드포스는 서버 `cardInfo`를 그대로 표시한다.
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
    const cardInfo = item.cardInfo
    if (!cardInfo) throw new Error('서버 카드정보 응답이 없습니다.')
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
    const skills = cardInfo.skills.filter((skill) => skill.code !== null)
    const skillRows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: skills.find((skill) => skill.slot === slot),
    }))
    const hasSkill = skills.length > 0
    const goldforceDays = cardInfo.frame.remainingGoldforceDays
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
                    name={cardInfo.shortName}
                    frame={cardInfo.frame}
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
                    {cardInfo.frame.type === 'GOLD' && (
                        <span className="rounded-full bg-brand-highlight-soft px-2.5 py-1 text-[11px] font-bold text-brand-highlight-deep">
                            골드포스 {goldforceDays}일 남음
                        </span>
                    )}
                </div>

                <h2 className="mt-4 text-xl font-bold leading-tight text-content-fg lg:text-2xl">
                    {cardInfo.formalName}
                </h2>
                <p className="mt-2 text-sm text-content-subtle">
                    {cardInfo.kind.label} · {cardInfo.element.label} · Lv.
                    {cardInfo.level}
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
                                {skill?.name ?? '-'}
                                {skill?.percent !== null &&
                                    skill?.percent !== undefined && (
                                        <span className="item-skill-percent">
                                            ({skill.percent}%)
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
