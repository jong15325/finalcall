import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { TbAlertTriangle, TbArrowLeft, TbSearchOff } from 'react-icons/tb'
import { paths } from '@/app/paths'
import ShopHeroCard from '@/features/shop/components/ShopHeroCard'
import ShopBuyPanel from '@/features/shop/components/ShopBuyPanel'
import ShopPurchaseDialog from '@/features/shop/components/ShopPurchaseDialog'
import { useNow } from '@/features/auction/lib/useNow'
import { useShopDetail, usePurchaseShop } from '@/lib/queries/shop'
import { useMyBalance } from '@/lib/queries/balance'
import { useIsAuthenticated, useAuthStore } from '@/store/authStore'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { hasErrorCode } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import { useAppFooterVariant } from '@/components/layout/AppFooterContext'

/**
 * 고정가 마켓 상세·구매 `/market/:id` (FC-094 게이트 — 경매 상세를 고정가로 변형).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **디자인 정본 = 승인된 경매 상세(`AuctionDetailPage`)를 고정가로 변형**(게이트 2026-07-22).
 * ══════════════════════════════════════════════════════════════════════════════
 * 새 비주얼 언어를 창작하지 않고 경매 상세의 레이아웃(히어로 | 패널)을 그대로 쓰되, **입찰·마감·
 * 카운트다운을 제거**하고 고정가 특성(정가·남은 판매기간·"바로 구매")만 반영한다.
 *  - `ShopHeroCard`(아이템 표시 공용부 재사용) | `ShopBuyPanel`(정가·바로 구매 CTA).
 *  - **구매는 `ShopPurchaseDialog`**(목록에서 상세로 이동) — §18 로딩 정책.
 *  - **골드포스·남은기간은 단일 타이머**(`useNow`) 값으로 파생.
 * ★ 데이터는 `useShopDetail`(GET /shops/{id}). SHOP_003(404)은 전용 빈상태. 데모 데이터 없음.
 */

const TOAST_MS = 5000

export default function MarketDetailPage() {
    const { id = '' } = useParams()
    const now = useNow()
    const location = useLocation()

    const detailQuery = useShopDetail(id)
    const balanceQuery = useMyBalance()
    const isAuthed = useIsAuthenticated()
    const myNickname = useAuthStore((state) => state.user?.nickname ?? null)

    const purchaseMutation = usePurchaseShop(id)

    const [purchaseOpen, setPurchaseOpen] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(null), TOAST_MS)
        return () => clearTimeout(timer)
    }, [toast])

    const shop = detailQuery.data
    useAppFooterVariant(
        !detailQuery.isPending && (detailQuery.isError || !shop)
            ? 'compact'
            : 'default',
    )

    // ── 로딩 ────────────────────────────────────────────────────────────────
    if (detailQuery.isPending) {
        return <DetailSkeleton />
    }

    // ── 에러(없음·전송 실패) ──────────────────────────────────────────────────
    if (detailQuery.isError || !shop) {
        const notFound = hasErrorCode(detailQuery.error, ERROR_CODES.SHOP_003)
        return (
            <StateBlock
                icon={notFound ? TbSearchOff : TbAlertTriangle}
                title={
                    notFound
                        ? '상품을 찾을 수 없습니다'
                        : '상품을 불러오지 못했습니다'
                }
                description={
                    notFound
                        ? '이미 내려갔거나 주소가 잘못되었습니다.'
                        : '잠시 후 다시 시도해 주세요.'
                }
                action={
                    notFound ? (
                        <Link
                            to={paths.market}
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        >
                            마켓 목록으로
                        </Link>
                    ) : (
                        <button
                            type="button"
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                            onClick={() => void detailQuery.refetch()}
                        >
                            다시 시도
                        </button>
                    )
                }
            />
        )
    }

    const isOwn = myNickname !== null && myNickname === shop.sellerNickname
    const loginHref = `${paths.login}${buildReturnUrlQuery(location)}`

    const openPurchase = () => {
        purchaseMutation.reset()
        setPurchaseOpen(true)
    }

    const handlePurchase = () => {
        purchaseMutation.mutate(undefined, {
            onSuccess: () => {
                setPurchaseOpen(false)
                setToast(
                    '구매가 완료되었습니다. 아이템은 인벤토리에서 확인하세요.',
                )
            },
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <Link
                to={paths.market}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
            >
                <TbArrowLeft aria-hidden className="size-4" />
                아이템 마켓
            </Link>

            {toast && (
                <p
                    role="status"
                    className="rounded-lg bg-success-subtle px-4 py-2.5 text-sm font-medium text-success"
                >
                    {toast}
                </p>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
                {/* 모바일: 구매 패널을 먼저(즉시 진입, 경매 상세와 동일) */}
                <div className="order-2 lg:order-1">
                    <ShopHeroCard shop={shop} now={now} />
                </div>
                <div className="order-1 lg:order-2">
                    <ShopBuyPanel
                        shop={shop}
                        now={now}
                        balance={balanceQuery.data}
                        isAuthed={isAuthed}
                        isOwn={isOwn}
                        loginHref={loginHref}
                        onBuy={openPurchase}
                    />
                </div>
            </div>

            <ShopPurchaseDialog
                open={purchaseOpen}
                itemName={shop.item.nameSnapshot}
                price={shop.price}
                gameMoneyAvailable={
                    isAuthed
                        ? (balanceQuery.data?.gameMoneyAvailable ?? null)
                        : null
                }
                isSubmitting={purchaseMutation.isPending}
                submitError={purchaseMutation.error}
                onClose={() => setPurchaseOpen(false)}
                onConfirm={handlePurchase}
            />
        </div>
    )
}

/** 상세 스켈레톤 — 전체 블러 금지, 영역만. */
function DetailSkeleton() {
    return (
        <div aria-hidden className="flex flex-col gap-6">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
                <div className="min-h-[390px] animate-pulse rounded-2xl bg-gray-100" />
                <div className="min-h-[390px] animate-pulse rounded-2xl bg-gray-100" />
            </div>
        </div>
    )
}

function StateBlock({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <Icon aria-hidden className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
