import { Link } from 'react-router'
import { auctionDetailPath } from '@/app/paths'
import ItemCard from '@/features/item/components/ItemCard'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
} from '@/features/auction/lib/auctionPhase'
import type { AuctionPhase } from '@/features/auction/lib/auctionPhase'
import {
    auctionPriceOf,
    bidCountLabelOf,
} from '@/features/auction/lib/auctionPrice'
import Countdown from './Countdown'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 경매 카드 (FC-071 — design-brief B-2·D "카드(경매)").
 *
 * 보존 `ItemCard`(아트·이름·설명·가격·스킬)에 경매 고유 정보(상태 배지·카운트다운·입찰수·판매자)를
 * **합성**한다 — ItemCard 는 재작성하지 않고 `overlay`/`footer` 슬롯으로만 확장한다(FC-068 규약).
 *
 * ★ **가격 = `highestBidAmount ?? startPrice`**, 라벨은 입찰 유무로 갈린다(현재가/시작가,
 *   `auctionPrice.ts`). 입찰 0건이면 CodeAmount 가 "-" 로 폴백.
 * ★ **상태 = 클라 파생 phase**(`auctionPhaseOf`, `now>=endAt`) — 서버 status 를 그대로 배지에
 *   쓰지 않는다(마감 강등 워커 부재). 카운트다운도 같은 `now` 로 흐른다.
 * ★ **카드 전체가 상세 링크**다. 경매 item 블록엔 인스턴스 ID 가 없어(§2.1) 링크 대상은
 *   `auctionPublicId` 뿐이다 — ItemCard 는 링크를 만들지 않으므로 여기서 감싼다.
 * ★ 판매자는 `sellerNickname` **원문**(마스킹 미결·§8). 문자열 비교로 본인 판정을 하지 않는다.
 */

const PHASE_BADGE_CLASS: Record<AuctionPhase, string> = {
    live: 'bg-success-subtle text-success',
    scheduled: 'bg-navy/10 text-navy-700',
    ended: 'bg-gray-100 text-gray-500',
}

interface AuctionCardProps {
    auction: AuctionSummary
    /** 현재 시각(ms) — 목록이 단일 타이머로 주입 */
    now: number
}

function AuctionCard({ auction, now }: AuctionCardProps) {
    const phase = auctionPhaseOf(
        {
            status: auction.status,
            startAt: auction.startAt,
            endAt: auction.endAt,
        },
        now,
    )
    const price = auctionPriceOf(auction)

    return (
        <Link
            to={auctionDetailPath(auction.auctionPublicId)}
            aria-label={`${auction.item.nameSnapshot} 경매 상세 보기`}
            className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
            <ItemCard
                item={auction.item}
                price={price.amount}
                priceLabel={price.label}
                now={now}
                className="h-full transition-shadow group-hover:shadow-md"
                overlay={
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PHASE_BADGE_CLASS[phase]}`}
                    >
                        {auctionPhaseLabelOf(phase)}
                    </span>
                }
                footer={
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <Countdown endAt={auction.endAt} now={now} />
                            <span className="whitespace-nowrap text-[11px] text-gray-500">
                                {bidCountLabelOf(auction.bidCount)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                {elementBadgeLabelOf(auction.item.element)}
                            </span>
                            <span className="min-w-0 truncate text-[11px] text-gray-400">
                                판매자 {auction.sellerNickname}
                            </span>
                        </div>
                    </div>
                }
            />
        </Link>
    )
}

export default AuctionCard
