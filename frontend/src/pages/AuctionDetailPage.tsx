import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { TbAlertTriangle, TbArrowLeft, TbSearchOff } from 'react-icons/tb'
import { paths } from '@/app/paths'
import AuctionHeroCard from '@/features/auction/components/AuctionHeroCard'
import BidPanel from '@/features/auction/components/BidPanel'
import BidDialog from '@/features/auction/components/BidDialog'
import BidHistory from '@/features/auction/components/BidHistory'
import PurchaseDialog from '@/features/auction/components/PurchaseDialog'
import {
    auctionPhaseOf,
    isOwnAuction,
} from '@/features/auction/lib/auctionPhase'
import { useNow } from '@/features/auction/lib/useNow'
import {
    useAuctionDetail,
    useCancelAuction,
    usePlaceBid,
    usePurchaseAuction,
} from '@/lib/queries/auctions'
import { useMyBalance } from '@/lib/queries/balance'
import { useIsAuthenticated, useAuthStore } from '@/store/authStore'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { hasErrorCode } from '@/lib/api/errors'
import { ERROR_CODES } from '@/types/errorCodes'
import ElementDetailBackground from '@/features/item/components/ElementDetailBackground'

/**
 * 경매 상세·입찰 (FC-072 — 목업 `#auction-detail` · design-brief B-3/B-4 · rebuild-contract-map §2).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **EPIC-FE-REBUILD 최고위험 화면. FC-064 함정 6건이 전부 여기.**
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **단일 타이머**(`useNow` 1회 구독) 값을 카운트다운·골드포스·상태 파생에 내려보낸다.
 * ★ **마감 판정은 클라**(`auctionPhaseOf` = `now>=endAt`) — 서버 status 불신(강등 워커 부재).
 * ★ **입찰 다이얼로그는 `open` prop 으로만 제어** — 매초 리렌더가 다이얼로그 초점을 강탈하지 않도록
 *   초점·스크롤잠금 effect 의존을 `[open]` 으로 격리한다(BidDialog 내부).
 * ★ 실 API 로딩/에러 우아하게 — 데모 데이터 하드코딩 없음. AUCTION_004 는 전용 빈상태.
 */

const TOAST_MS = 5000

export default function AuctionDetailPage() {
    const { id = '' } = useParams()
    const now = useNow()
    const location = useLocation()

    const detailQuery = useAuctionDetail(id)
    const balanceQuery = useMyBalance()
    const isAuthed = useIsAuthenticated()
    const myNickname = useAuthStore((state) => state.user?.nickname ?? null)

    const bidMutation = usePlaceBid(id)
    const cancelMutation = useCancelAuction(id)
    const purchaseMutation = usePurchaseAuction(id)

    const [bidOpen, setBidOpen] = useState(false)
    const [purchaseOpen, setPurchaseOpen] = useState(false)
    const [toast, setToast] = useState<string | null>(null)

    // 토스트 자동 소멸(성공 안내는 오래 남겨 두지 않는다).
    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(() => setToast(null), TOAST_MS)
        return () => clearTimeout(timer)
    }, [toast])

    const auction = detailQuery.data

    // ── 로딩 ────────────────────────────────────────────────────────────────
    if (detailQuery.isPending) {
        return <DetailSkeleton />
    }

    // ── 에러(없음·전송 실패) ──────────────────────────────────────────────────
    if (detailQuery.isError || !auction) {
        const notFound = hasErrorCode(
            detailQuery.error,
            ERROR_CODES.AUCTION_004,
        )
        return (
            <StateBlock
                icon={notFound ? TbSearchOff : TbAlertTriangle}
                title={
                    notFound
                        ? '경매를 찾을 수 없습니다'
                        : '경매를 불러오지 못했습니다'
                }
                description={
                    notFound
                        ? '이미 삭제되었거나 주소가 잘못되었습니다.'
                        : '잠시 후 다시 시도해 주세요.'
                }
                action={
                    notFound ? (
                        <Link
                            to={paths.auctions}
                            className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-800"
                        >
                            경매 목록으로
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

    const phase = auctionPhaseOf(
        {
            status: auction.status,
            startAt: auction.startAt,
            endAt: auction.endAt,
        },
        now,
    )
    const isOwn = isOwnAuction(auction.sellerNickname, myNickname)
    const loginHref = `${paths.login}${buildReturnUrlQuery(location)}`

    const openBid = () => {
        bidMutation.reset()
        setBidOpen(true)
    }

    const openPurchase = () => {
        purchaseMutation.reset()
        setPurchaseOpen(true)
    }

    const handleBidSubmit = (amount: number) => {
        bidMutation.mutate(amount, {
            onSuccess: () => {
                setBidOpen(false)
                setToast(
                    '입찰이 접수되었습니다. 현재 최고가와 마감 시각이 갱신됩니다.',
                )
            },
        })
    }

    const handlePurchase = () => {
        purchaseMutation.mutate(undefined, {
            onSuccess: () => {
                setPurchaseOpen(false)
                setToast(
                    '즉시구매로 낙찰되었습니다. 아이템은 인벤토리에서 확인하세요.',
                )
            },
        })
    }

    const handleCancel = () => {
        cancelMutation.mutate(undefined, {
            onSuccess: () => setToast('경매를 취소했습니다.'),
        })
    }

    return (
        <ElementDetailBackground element={auction.item.element}>
            <div className="flex flex-col gap-6">
                <Link
                    to={paths.auctions}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
                >
                    <TbArrowLeft aria-hidden className="size-4" />
                    경매 목록
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
                    {/* 모바일: bid-panel 을 먼저(입찰 즉시 진입, design-brief C-7) */}
                    <div className="order-2 lg:order-1">
                        <AuctionHeroCard
                            auction={auction}
                            phase={phase}
                            now={now}
                        />
                    </div>
                    <div className="order-1 lg:order-2">
                        <BidPanel
                            auction={auction}
                            phase={phase}
                            now={now}
                            balance={balanceQuery.data}
                            isAuthed={isAuthed}
                            isOwn={isOwn}
                            loginHref={loginHref}
                            cancelPending={cancelMutation.isPending}
                            cancelError={cancelMutation.error}
                            onBid={openBid}
                            onBuyNow={openPurchase}
                            onCancel={handleCancel}
                        />
                    </div>
                </div>

                <BidHistory auctionPublicId={id} />

                <BidDialog
                    open={bidOpen}
                    auctionName={auction.item.nameSnapshot}
                    currentHighestAmount={auction.highestBidAmount}
                    minNextBidAmount={auction.minNextBidAmount}
                    buyNowPrice={auction.buyNowPrice}
                    gameMoneyAvailable={
                        balanceQuery.data?.gameMoneyAvailable ?? null
                    }
                    isSubmitting={bidMutation.isPending}
                    submitError={bidMutation.error}
                    onClose={() => setBidOpen(false)}
                    onSubmit={handleBidSubmit}
                />

                {auction.buyNowPrice !== null && (
                    <PurchaseDialog
                        open={purchaseOpen}
                        auctionName={auction.item.nameSnapshot}
                        buyNowPrice={auction.buyNowPrice}
                        gameMoneyAvailable={
                            balanceQuery.data?.gameMoneyAvailable ?? null
                        }
                        isSubmitting={purchaseMutation.isPending}
                        submitError={purchaseMutation.error}
                        onClose={() => setPurchaseOpen(false)}
                        onConfirm={handlePurchase}
                    />
                )}
            </div>
        </ElementDetailBackground>
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
            <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
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
