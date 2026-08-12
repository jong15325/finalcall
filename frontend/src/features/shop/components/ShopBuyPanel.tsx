import { Link } from 'react-router'
import CodeAmount from '@/components/common/CodeAmount'
import {
    isShopPurchasable,
    shopRemainingDays,
    shopStatusLabelOf,
} from '@/features/shop/lib/shopStatus'
import type { ShopDetail } from '@/lib/api/shop'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 고정가 구매 패널 (FC-094 — 경매 `BidPanel` 을 고정가로 변형).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **경매 상세의 승인된 패널 디자인을 재사용**하되 **입찰·카운트다운·최고가를 제거**한다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 남는 것: 판매가(정수 전체표기·navy 블록) + 남은 판매기간(일) + 사용 가능 게임머니 + 판매자 +
 * **"바로 구매" CTA**(→ `ShopPurchaseDialog`). 경매의 "다음 최소 입찰가"·초 단위 카운트다운은 없다.
 *
 * ★ **CTA 는 상태로 갈린다**: 판매종료(SOLD·EXPIRED·CANCELLED)→비활성 / 비로그인→"로그인하고 구매"
 *   (returnUrl) / 판매자 본인→비활성(취소 UI 는 FC-096 범위) / 판매 중→"바로 구매".
 * ★ **비활성은 DOM 속성**(`disabled`) — 색만 바꾸지 않는다(WCAG 4.1.2). 표시 제어이며 최종 판정은
 *   서버(SHOP_004·SHOP_006).
 * ★ 금액은 **전체표기**(§3.3 상세/거래확정) — `CodeAmount mode="full"` 이 `aria-label` 로 전체값 제공.
 */

interface ShopBuyPanelProps {
    shop: ShopDetail
    now: number
    balance: BalanceResponse | undefined
    isAuthed: boolean
    /** 판매자 본인 여부(닉네임 파생 표시 제어 — 인가는 서버) */
    isOwn: boolean
    /** 비로그인 시 이동할 로그인 경로(returnUrl 포함) */
    loginHref: string
    /** 바로 구매 → 확인 다이얼로그 열기 */
    onBuy: () => void
}

function ShopBuyPanel({
    shop,
    now,
    balance,
    isAuthed,
    isOwn,
    loginHref,
    onBuy,
}: ShopBuyPanelProps) {
    const purchasable = isShopPurchasable(shop.status, shop.endAt, now)
    const remainingDays = shopRemainingDays(shop.endAt, now)

    return (
        <aside className="rounded-2xl border border-content-line bg-content-surface">
            <div className="flex flex-col p-5 lg:sticky lg:top-24">
                {/* 판매가 — 브랜드 navy 블록(전체표기) */}
                <div className="my-1 grid gap-1 rounded-xl bg-brand-structure p-5 text-on-strong">
                    <span className="text-xs text-on-strong/70">판매가</span>
                    <CodeAmount
                        value={shop.price}
                        mode="full"
                        className="text-2xl font-bold"
                    />
                    <span className="text-xs text-on-strong/60">
                        판매자 {shop.sellerNickname}
                    </span>
                </div>

                <dl className="my-5">
                    {remainingDays !== null && (
                        <div className="flex items-center justify-between border-b border-content-line py-2.5 text-sm">
                            <dt className="font-medium text-content-subtle">
                                남은 판매기간
                            </dt>
                            <dd className="font-semibold text-content-fg">
                                {remainingDays > 0
                                    ? `${remainingDays}일 남음`
                                    : '오늘 종료'}
                            </dd>
                        </div>
                    )}
                    {isAuthed && (
                        <div className="flex items-center justify-between border-b border-content-line py-2.5 text-sm">
                            <dt className="font-medium text-content-subtle">
                                사용 가능 게임머니
                            </dt>
                            <dd className="font-semibold text-content-fg">
                                <CodeAmount
                                    value={balance?.gameMoneyAvailable ?? null}
                                    mode="full"
                                />
                            </dd>
                        </div>
                    )}
                </dl>

                {/* CTA — 상태별 분기 */}
                {!purchasable ? (
                    <>
                        <button
                            disabled
                            type="button"
                            className="w-full rounded-lg bg-content-line px-5 py-3.5 text-sm font-bold text-content-subtle disabled:cursor-not-allowed"
                        >
                            {shopStatusLabelOf(shop.status)}
                        </button>
                        <p className="mt-3 text-center text-xs text-content-subtle">
                            지금은 구매할 수 없는 상품입니다.
                        </p>
                    </>
                ) : isOwn ? (
                    <>
                        <button
                            disabled
                            type="button"
                            className="w-full rounded-lg bg-content-line px-5 py-3.5 text-sm font-bold text-content-subtle disabled:cursor-not-allowed"
                        >
                            내 상품입니다
                        </button>
                        <p className="mt-3 text-center text-xs text-content-subtle">
                            내가 등록한 상품은 구매할 수 없습니다.
                        </p>
                    </>
                ) : !isAuthed ? (
                    <Link
                        to={loginHref}
                        className="block w-full rounded-lg bg-control-action px-5 py-3.5 text-center text-sm font-bold text-on-strong hover:bg-control-action-hover"
                    >
                        로그인하고 구매
                    </Link>
                ) : (
                    <button
                        type="button"
                        className="w-full rounded-lg bg-control-action px-5 py-3.5 text-sm font-bold text-on-strong hover:bg-control-action-hover"
                        onClick={onBuy}
                    >
                        바로 구매
                    </button>
                )}

                <p className="mt-3 text-center text-xs text-content-subtle">
                    구매하면 게임머니가 바로 차감되고 아이템은 인벤토리로
                    들어옵니다.
                </p>
                <p className="mt-2 text-center text-[11px] text-content-subtle">
                    구매자 수수료 없음. 판매자는 판매가 구간별 수수료 차감 후
                    정산.
                </p>
            </div>
        </aside>
    )
}

export default ShopBuyPanel
