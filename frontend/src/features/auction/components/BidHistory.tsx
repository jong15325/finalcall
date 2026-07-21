import CodeAmount from '@/components/common/CodeAmount'
import { useAuctionBids } from '@/lib/queries/auctions'
import type { BidStatus } from '@/lib/api/auctions'

/**
 * 입찰 이력 (FC-072 — 목업 `.bid-history` · design-brief B-3).
 *
 * `GET /auctions/{id}/bids` — **offset 페이징**(`?page=&size=`, `amount desc` 고정, size≤100).
 * 표: 입찰자(마스킹)·금액·상태·시각. 자금(홀드·잔액) 정보는 계약이 싣지 않는다(타인 자금 비노출).
 *
 * ★ 상태 라벨은 서버 enum 파생 — 미등록 상태는 코드 그대로(무음 실패 방지).
 * ★ "내 입찰" 은 표시할 방법이 없다(bidderMasked 뿐, userPublicId 미제공) — 만들지 않는다.
 */

const STATUS_LABEL: Record<string, string> = {
    ACTIVE: '최고 입찰',
    OUTBID: '상위 입찰됨',
    WON: '낙찰',
}

const STATUS_CLASS: Record<string, string> = {
    ACTIVE: 'bg-success-subtle text-success',
    OUTBID: 'bg-gray-100 text-gray-500',
    WON: 'bg-navy/10 text-navy-700',
}

const dateTime = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

function bidStatusLabel(status: BidStatus): string {
    return STATUS_LABEL[status] ?? status
}

function formatBidTime(iso: string): string {
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? dateTime.format(ms) : '-'
}

interface BidHistoryProps {
    auctionPublicId: string
}

function BidHistory({ auctionPublicId }: BidHistoryProps) {
    const {
        data,
        isPending,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useAuctionBids(auctionPublicId)

    const bids = data?.pages.flatMap((page) => page.content) ?? []

    return (
        <section className="rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
                <h3 className="text-base font-bold text-gray-900">입찰 이력</h3>
            </div>

            {isPending ? (
                <div aria-hidden className="space-y-2 p-5">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={index}
                            className="h-9 animate-pulse rounded bg-gray-100"
                        />
                    ))}
                </div>
            ) : isError ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                    입찰 이력을 불러오지 못했습니다.
                </p>
            ) : bids.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-500">
                    아직 입찰이 없습니다. 첫 입찰의 주인공이 되어 보세요.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-line text-left text-xs text-gray-500">
                                <th className="px-5 py-2.5 font-medium">
                                    입찰자
                                </th>
                                <th className="px-5 py-2.5 font-medium">
                                    금액
                                </th>
                                <th className="px-5 py-2.5 font-medium">
                                    상태
                                </th>
                                <th className="px-5 py-2.5 text-right font-medium">
                                    입찰 시각
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {bids.map((bid) => (
                                <tr
                                    key={bid.bidPublicId}
                                    className="border-b border-line last:border-0"
                                >
                                    <td className="px-5 py-3 text-gray-700">
                                        {bid.bidderMasked}
                                    </td>
                                    <td className="px-5 py-3">
                                        <CodeAmount
                                            value={bid.amount}
                                            mode="full"
                                            className="font-semibold text-gray-900"
                                        />
                                    </td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                                STATUS_CLASS[bid.status] ??
                                                'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {bidStatusLabel(bid.status)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right text-gray-500">
                                        {formatBidTime(bid.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {hasNextPage && (
                        <div className="p-4 text-center">
                            <button
                                type="button"
                                disabled={isFetchingNextPage}
                                className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-60"
                                onClick={() => void fetchNextPage()}
                            >
                                {isFetchingNextPage ? '불러오는 중…' : '더 보기'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

export default BidHistory
