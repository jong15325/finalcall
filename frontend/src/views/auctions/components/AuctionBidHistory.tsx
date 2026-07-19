import { PiGavelDuotone, PiPlugsDuotone } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import SectionNotice from '@/components/shared/SectionNotice'
import { formatGameMoney } from '@/features/auction/lib/auctionPrice'
import { useAuctionBids } from '@/lib/queries/auctions'
import type { BidSummary } from '@/lib/api/auctions'

/**
 * 입찰 이력 (계약 §3.1 `GET /auctions/{id}/bids` · §3.3 `BidSummary`) — FC-064.
 *
 * ★ **인증 불요 공개 엔드포인트다.** 입찰자는 마스킹된 닉네임뿐이고 `userPublicId` 도
 *   홀드 금액도 오지 않는다(SEC-007 회원 열거 방지 · 타인 자금 노출 금지). 그래서
 *   **"내 입찰" 을 표시할 방법이 없다** — 만들려고 응답에 없는 값을 추측하지 마라.
 *
 * ★ 정렬은 서버가 `amount desc` 로 고정한다. 입찰액이 단조 증가하므로 이것이 곧 최신순이고,
 *   화면이 다시 정렬하지 않는다(정렬 컨트롤을 만들면 계약에 없는 축을 지어내게 된다).
 *
 * ★★ **"더 보기" 버튼이 유일한 페이지 전진 수단이다** — 이력은 목록과 달리 센티넬을 두지
 *    않았다. 접힌 섹션 안이라 뷰포트 교차가 사용자의 의도와 어긋나기 쉽고, 버튼 하나면
 *    마우스·키보드·스크린리더가 **같은 경로**를 쓴다(FC-059 가 목록에서 얻은 교훈의 단순화).
 */

interface AuctionBidHistoryProps {
    auctionPublicId: string
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
})

/** 실패한 파싱은 원문을 그대로 보여준다 — 빈 칸보다 낫다. */
function formatBidTime(createdAt: string): string {
    const parsed = Date.parse(createdAt)
    return Number.isFinite(parsed) ? timeFormat.format(parsed) : createdAt
}

/** `status` 는 계약 3값 + 미등록 폴백. 미등록 코드는 **표기하지 않는다**(지어내지 않는다). */
function bidStatusLabelOf(status: BidSummary['status']): string | null {
    switch (status) {
        case 'ACTIVE':
            return '최고 입찰'
        case 'OUTBID':
            return '밀림'
        case 'WON':
            return '낙찰'
        default:
            return null
    }
}

const AuctionBidHistory = ({ auctionPublicId }: AuctionBidHistoryProps) => {
    const {
        data,
        isPending,
        isError,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
    } = useAuctionBids(auctionPublicId)

    if (isPending) {
        return (
            <div
                className="flex flex-col gap-2"
                data-testid="bid-history-skeleton"
            >
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} height={40} className="w-full" />
                ))}
            </div>
        )
    }

    if (isError) {
        return (
            <SectionNotice
                data-testid="bid-history-error"
                description="경매 정보는 그대로 있습니다. 이력만 다시 불러옵니다."
                icon={<PiPlugsDuotone />}
                title="입찰 이력을 불러오지 못했습니다"
                onRetry={() => void refetch()}
            />
        )
    }

    const bids = data.pages.flatMap((page) => page.content)

    if (bids.length === 0) {
        return (
            <SectionNotice
                data-testid="bid-history-empty"
                description="첫 입찰이 되면 여기에 기록됩니다."
                icon={<PiGavelDuotone />}
                title="아직 입찰이 없습니다"
            />
        )
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {/*
             * ★ 표가 아니라 목록이다 — 320px 에서 3열 표는 열이 눌려 글자가 세로로 접힌다.
             *   각 행은 [닉네임 + 시각] | [금액 + 상태] 두 덩어리이고 `min-w-0` 로 눌린다.
             */}
            <ul
                className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700"
                data-testid="bid-history-list"
            >
                {bids.map((bid) => {
                    const statusLabel = bidStatusLabelOf(bid.status)
                    return (
                        <li
                            key={bid.bidPublicId}
                            className="flex min-w-0 items-center justify-between gap-3 py-2.5"
                        >
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {bid.bidderMasked}
                                </span>
                                <time
                                    className="text-xs text-gray-500 dark:text-gray-400"
                                    dateTime={bid.createdAt}
                                >
                                    {formatBidTime(bid.createdAt)}
                                </time>
                            </div>
                            <div className="flex shrink-0 flex-col items-end">
                                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                                    {formatGameMoney(bid.amount)} GM
                                </span>
                                {statusLabel && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {statusLabel}
                                    </span>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>

            {hasNextPage && (
                <Button
                    className="self-center"
                    data-testid="bid-history-more"
                    loading={isFetchingNextPage}
                    size="sm"
                    type="button"
                    onClick={() => void fetchNextPage()}
                >
                    더 보기
                </Button>
            )}
        </div>
    )
}

export default AuctionBidHistory
