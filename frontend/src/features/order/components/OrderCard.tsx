import CodeAmount from '@/components/common/CodeAmount'
import ItemFrame from '@/features/item/components/ItemFrame'
import { elementLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import {
    counterpartyLabelOf,
    orderRoleLabelOf,
    orderSourceLabelOf,
    showsSellerAccounting,
} from '@/features/order/lib/orderView'
import type { OrderSummary } from '@/lib/api/orders'

/**
 * 거래내역 카드 — 가로형(FC-090 · 경매 카드 `AuctionCard` 형태 계승).
 *
 * 좌측 아트(공용 `ItemFrame`, `itemArt` 로 경로 파생) + 우측 copy(역할·출처 배지·상대·아이템·최종가).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **수수료·정산액은 판매자 카드에만.** 구매자 카드엔 최종가만 — 판매자 회계는 안 보인다.
 * ══════════════════════════════════════════════════════════════════════════════
 * `showsSellerAccounting`(역할로 판정, 값 유무 아님)이 참일 때만 수수료/정산 행을 그린다
 * (계약 §4.3 · purchase-spec §5.2). 상대는 이미 마스킹돼 오므로 그대로 표기한다.
 *
 * ★ 금액은 `CodeAmount`(정수·**full** 모드) — 거래 확정 내역이라 축약이 아닌 원본 표기(§3.1).
 * ★ 색은 브랜드 토큰(navy/gold/gray). 상세 링크는 걸지 않는다(주문 상세는 이번 범위 밖 — 목록만).
 */

interface OrderCardProps {
    order: OrderSummary
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

function OrderCard({ order }: OrderCardProps) {
    const { item } = order
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        1,
    )
    const hasSkill = item.skill1 !== null || item.skill2 !== null
    const isSeller = order.myRole === 'SELLER'
    const showsAccounting = showsSellerAccounting(order)

    const tradedAt = Date.parse(order.createdAt)
    const dateLabel = Number.isFinite(tradedAt)
        ? dateFormat.format(tradedAt)
        : ''

    return (
        <article className="grid grid-cols-[102px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface xs:grid-cols-[112px_minmax(0,1fr)]">
            {/* 아트 열 */}
            <ItemFrame
                fill
                imageUrl={art?.src}
                spriteUrl={art?.src}
                name={item.nameSnapshot}
                visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                hasSkill={hasSkill}
                size="stage"
            />

            {/* copy 열 */}
            <div className="flex min-w-0 flex-col px-3 py-3.5 xs:p-[17px]">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isSeller
                                    ? 'bg-gold-subtle text-gold-deep'
                                    : 'bg-navy/10 text-navy-700'
                            }`}
                        >
                            {orderRoleLabelOf(order.myRole)}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-gray-500">
                            {orderSourceLabelOf(order.sourceType)} ·{' '}
                            {elementLabelOf(item.element)}
                        </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-gray-400">
                        {dateLabel}
                    </span>
                </div>

                <h3 className="mb-1 mt-3 line-clamp-2 text-[15px] font-bold leading-tight text-gray-900">
                    {item.nameSnapshot}
                </h3>
                <p className="truncate text-xs text-gray-500">
                    {item.specSnapshot} · Lv.{item.level}
                </p>
                <p className="mt-1 truncate text-xs text-gray-500">
                    {counterpartyLabelOf(order)}
                </p>

                <dl className="mt-3 border-t border-line pt-3 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-xs font-medium text-gray-500">
                            {isSeller ? '판매가' : '결제 금액'}
                        </dt>
                        <dd>
                            <CodeAmount
                                value={order.finalPrice}
                                mode="full"
                                className="font-bold text-gray-900"
                            />
                        </dd>
                    </div>

                    {/* 판매자 전용 회계 — 구매자 카드엔 그리지 않는다 */}
                    {showsAccounting && (
                        <>
                            <div className="mt-1.5 flex items-center justify-between">
                                <dt className="text-xs font-medium text-gray-500">
                                    수수료
                                </dt>
                                <dd>
                                    <CodeAmount
                                        value={order.feeAmount ?? null}
                                        mode="full"
                                        className="font-semibold text-warning"
                                    />
                                </dd>
                            </div>
                            <div className="mt-1.5 flex items-center justify-between">
                                <dt className="text-xs font-medium text-gray-500">
                                    정산액
                                </dt>
                                <dd>
                                    <CodeAmount
                                        value={order.settleAmount ?? null}
                                        mode="full"
                                        className="font-bold text-success"
                                    />
                                </dd>
                            </div>
                        </>
                    )}
                </dl>
            </div>
        </article>
    )
}

export default OrderCard
