import { Link } from 'react-router'
import CodeAmount from '@/components/common/CodeAmount'
import Countdown from './Countdown'
import { bidErrorViewOf } from '@/features/auction/lib/bidErrors'
import { buyNowStateOf, endedResultNoteOf } from '@/features/auction/lib/buyNow'
import { formatGameMoney } from '@/features/auction/lib/auctionPrice'
import { type AuctionPhase } from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 입찰 패널 (FC-072 · 즉시구매 실연동 FC-090 — 목업 `.bid-panel`(sticky) · design-brief B-3/B-4).
 *
 * 목업 구조: 카운트다운 + `.current-price`(현재 최고가·최고입찰자) + `.bid-meta`(다음 최소가·가용
 * 게임머니·즉시구매가) + CTA + 안내문.
 *
 * ★ **CTA 는 상태로 갈린다**(auctionPhase): 마감→비활성 / 비로그인→"로그인하고 입찰"(returnUrl) /
 *   판매자 본인→입찰 숨김·취소 노출 / 진행→"입찰하기".
 * ★ **즉시구매 CTA 는 실연동**(FC-090, EPIC-PURCHASE v1.13): `buyNowStateOf` 로 활성 조건을 판정한다
 *   (설정됨 ∧ 라이브 ∧ 타인 경매). 비로그인은 로그인 유도, 활성은 확인 다이얼로그를 연다.
 * ★ **비활성은 DOM 속성**(`disabled`) — 색만 바꾸지 않는다(WCAG 4.1.2).
 * ★ 색은 브랜드 팔레트 — `.current-price` 는 브랜드 navy 블록(목업도 짙은 남색).
 */

interface BidPanelProps {
    auction: AuctionDetail
    phase: AuctionPhase
    now: number
    balance: BalanceResponse | undefined
    isAuthed: boolean
    /** 판매자 본인 여부(닉네임 파생 표시 제어 — 인가는 서버) */
    isOwn: boolean
    /** 비로그인 시 이동할 로그인 경로(returnUrl 포함) */
    loginHref: string
    /** 입찰하기 → 다이얼로그 열기 */
    onBid: () => void
    /** 즉시구매 → 확인 다이얼로그 열기 */
    onBuyNow: () => void
    /** 판매자 취소 */
    onCancel: () => void
    cancelPending: boolean
    cancelError: unknown
}

function BidPanel({
    auction,
    phase,
    now,
    balance,
    isAuthed,
    isOwn,
    loginHref,
    onBid,
    onBuyNow,
    onCancel,
    cancelPending,
    cancelError,
}: BidPanelProps) {
    const isEnded = phase === 'ended'
    const hasBids =
        auction.highestBidAmount !== null &&
        auction.highestBidAmount !== undefined
    /** 취소는 입찰 0건 & (SCHEDULED|ACTIVE)일 때만 서버가 허용(계약 §3.1) */
    const cancellable = !isEnded && auction.bidCount === 0
    const cancelErrorView =
        cancelError != null ? bidErrorViewOf(cancelError, null) : null
    /** 즉시구매 활성 조건(설정됨 ∧ 라이브 ∧ 타인) — 표시 제어, 인가는 서버(AUCTION_009) */
    const buyNowState = buyNowStateOf({
        buyNowPrice: auction.buyNowPrice,
        phase,
        isOwn,
        isAuthed,
    })

    return (
        <aside className="detail-surface rounded-2xl border border-content-line bg-content-surface lg:flex lg:h-full lg:flex-col">
            <div className="flex flex-col p-5 lg:sticky lg:top-28 lg:my-auto">
                <div className="flex items-center justify-between">
                    <Countdown endAt={auction.endAt} now={now} />
                    {auction.extensionCount > 0 && (
                        <span className="text-xs text-content-subtle">
                            연장 {auction.extensionCount}회
                        </span>
                    )}
                </div>

                {/* 현재 최고가 — 브랜드 navy 블록 */}
                <div className="my-5 grid gap-1 rounded-xl bg-brand-structure p-5 text-on-strong">
                    <span className="text-xs text-on-strong/70">
                        {hasBids ? '현재 최고가' : '시작가'}
                    </span>
                    <CodeAmount
                        value={
                            hasBids
                                ? auction.highestBidAmount
                                : auction.startPrice
                        }
                        mode="full"
                        className="text-2xl font-bold"
                    />
                    <span className="text-xs text-on-strong/60">
                        {hasBids && auction.highestBidderMasked
                            ? `최고 입찰자 ${auction.highestBidderMasked}`
                            : '아직 입찰이 없습니다'}
                    </span>
                </div>

                <dl className="mb-5">
                    <div className="flex items-center justify-between border-b border-content-line py-2.5 text-sm">
                        <dt className="font-medium text-content-subtle">
                            다음 최소 입찰가
                        </dt>
                        <dd className="font-semibold text-content-fg">
                            {/* 종료면 서버가 null 을 내린다 → "-" */}
                            <CodeAmount
                                value={auction.minNextBidAmount}
                                mode="full"
                            />
                        </dd>
                    </div>
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
                    {auction.buyNowPrice !== null && (
                        <div className="flex items-center justify-between border-b border-content-line py-2.5 text-sm">
                            <dt className="font-medium text-content-subtle">
                                즉시구매가
                            </dt>
                            <dd className="font-semibold text-content-fg">
                                <CodeAmount
                                    value={auction.buyNowPrice}
                                    mode="full"
                                />
                            </dd>
                        </div>
                    )}
                </dl>

                {/* CTA — 상태별 분기 */}
                {isEnded ? (
                    <button
                        disabled
                        type="button"
                        className="auction-ended-cta w-full rounded-lg bg-content-line px-5 py-3.5 text-sm font-bold text-content-subtle disabled:cursor-not-allowed"
                    >
                        입찰 마감
                    </button>
                ) : isOwn ? (
                    <>
                        <button
                            type="button"
                            disabled={!cancellable || cancelPending}
                            className="w-full rounded-lg border border-danger bg-content-surface px-5 py-3.5 text-sm font-bold text-danger-ink hover:bg-danger-soft disabled:cursor-not-allowed disabled:border-content-line disabled:text-content-subtle disabled:hover:bg-content-surface"
                            onClick={onCancel}
                        >
                            {cancelPending ? '취소 중…' : '경매 취소'}
                        </button>
                        <p className="mt-3 text-center text-xs text-content-subtle">
                            {cancellable
                                ? '내가 등록한 경매입니다. 입찰이 붙기 전에만 취소할 수 있습니다.'
                                : '입찰이 있어 취소할 수 없습니다.'}
                        </p>
                    </>
                ) : !isAuthed ? (
                    <Link
                        to={loginHref}
                        className="detail-cta block w-full rounded-lg bg-control-action px-5 py-3.5 text-center text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                    >
                        로그인하고 입찰
                    </Link>
                ) : (
                    <button
                        type="button"
                        className="detail-cta w-full rounded-lg bg-control-action px-5 py-3.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                        onClick={onBid}
                    >
                        입찰하기
                    </button>
                )}

                {/* 즉시구매 CTA — 입찰과 별개 경로(설정됨 ∧ 라이브 ∧ 타인일 때만) */}
                {buyNowState === 'available' &&
                    auction.buyNowPrice !== null && (
                        <button
                            type="button"
                            className="mt-2.5 w-full rounded-lg border border-brand-structure bg-content-surface px-5 py-3.5 text-sm font-bold text-brand-structure hover:bg-brand-structure hover:text-on-strong"
                            onClick={onBuyNow}
                        >
                            {formatGameMoney(auction.buyNowPrice)} 코드에
                            즉시구매
                        </button>
                    )}
                {buyNowState === 'login' && (
                    <Link
                        to={loginHref}
                        className="mt-2.5 block w-full rounded-lg border border-brand-structure bg-content-surface px-5 py-3.5 text-center text-sm font-bold text-brand-structure hover:bg-brand-structure hover:text-on-strong"
                    >
                        로그인하고 즉시구매
                    </Link>
                )}

                {/* 판매자 취소 실패(AUCTION_007·006·001) */}
                {isOwn && cancelErrorView && (
                    <p
                        role="alert"
                        className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                    >
                        {cancelErrorView.title}
                    </p>
                )}

                <p className="mt-3 text-center text-xs text-content-subtle">
                    {isEnded
                        ? endedResultNoteOf(auction.status, auction.resultType)
                        : buyNowState === 'hidden' &&
                            auction.buyNowPrice === null
                          ? '이 경매는 입찰로만 거래됩니다.'
                          : '즉시구매하면 입찰 없이 바로 낙찰됩니다.'}
                </p>
                <p className="mt-2 text-center text-[11px] text-content-subtle">
                    구매자 수수료 없음. 판매자는 낙찰가 구간별 수수료 차감 후
                    정산.
                </p>
            </div>
        </aside>
    )
}

export default BidPanel
