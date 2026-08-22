import { TbGavel } from 'react-icons/tb'
import { auctionDetailPath } from '@/app/paths'
import {
    AuctionInfoGroup,
    AuctionInfoRail,
    AuctionTimeDisplay,
} from '@/components/common/AuctionTimeDisplay'
import { countdownFrom } from '@/features/auction/lib/countdown'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
} from '@/features/auction/lib/auctionPhase'
import {
    auctionPriceOf,
    bidCountBadgeLabelOf,
    formatGameMoney,
} from '@/features/auction/lib/auctionPrice'
import ItemCardActionSurface from '@/features/item/components/ItemCardActionSurface'
import ItemCardView, {
    ItemCardArtwork,
} from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import type { AuctionSummary } from '@/lib/api/auctions'

const PHASE_TAG_CLASSES = {
    live: { badge: 'bg-success-soft text-success-ink', dot: 'bg-success' },
    scheduled: {
        badge: 'bg-brand-highlight-soft text-brand-highlight-deep',
        dot: 'bg-brand-highlight-bright',
    },
    ended: {
        badge: 'bg-content-soft text-content-muted',
        dot: 'bg-brand-structure',
    },
} as const

const TAG_STYLE = { gap: 5, padding: '3px 7px', borderRadius: 999 } as const
const TAG_DOT_STYLE = { width: 7, height: 7, borderRadius: '50%' } as const

interface AuctionCardProps {
    auction: AuctionSummary
    now: number
}

/** 아이템마켓 카드 composition에 경매 사실만 주입하는 목록 adapter. */
function AuctionCard({ auction, now }: AuctionCardProps) {
    const phase = auctionPhaseOf(auction, now)
    const price = auctionPriceOf(auction)
    const item = toItemCardViewModel(auction.item, now)
    const cardItem = {
        ...item,
        price,
        seller: auction.sellerNickname,
        skills: ([1, 2] as const).map(
            (slot) =>
                item.skills.find((skill) => skill.slot === slot) ?? {
                    slot,
                    label: '없음',
                },
        ),
    }
    const action = {
        kind: 'link' as const,
        to: auctionDetailPath(auction.auctionPublicId),
        label: `${item.name} 경매 상세 보기`,
    }
    const bidLabel = bidCountBadgeLabelOf(auction.bidCount)
    const countdown = countdownFrom(auction.endAt, now)

    return (
        <div data-auction-list-card className="relative h-full min-w-0">
            <ItemCardView
                fullHeight
                density="compact"
                artwork={
                    <>
                        <div
                            data-auction-artwork
                            className="relative h-[296px]"
                            data-market-artwork-height="252"
                        >
                            <ItemCardArtwork item={item} mode="fill" />
                            <span
                                data-auction-badge-stack
                                className="pointer-events-none absolute right-2 top-2 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1"
                            >
                                <span
                                    data-auction-phase-badge
                                    className={`inline-flex shrink-0 items-center whitespace-nowrap text-[10px] font-extrabold ${PHASE_TAG_CLASSES[phase].badge}`}
                                    style={TAG_STYLE}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={`shrink-0 ${PHASE_TAG_CLASSES[phase].dot}`}
                                        style={TAG_DOT_STYLE}
                                    />
                                    <span>{auctionPhaseLabelOf(phase)}</span>
                                </span>
                            </span>
                            <ItemCardActionSurface
                                area="artwork"
                                keyboard={false}
                                action={action}
                                className="!inset-0"
                            />
                        </div>
                        <AuctionInfoRail>
                            <AuctionInfoGroup>
                                <TbGavel aria-hidden />
                                {auction.bidCount > 0 ? (
                                    <span
                                        data-auction-bid-count
                                        aria-label={bidLabel.full}
                                        title={bidLabel.full}
                                    >
                                        {auction.bidCount < 10_000
                                            ? `입찰 ${formatGameMoney(auction.bidCount)}`
                                            : bidLabel.visible}
                                    </span>
                                ) : (
                                    <span>첫 입찰 대기</span>
                                )}
                            </AuctionInfoGroup>
                            <AuctionTimeDisplay
                                ariaLabel={countdown.ariaText}
                                className="ml-auto"
                                tone="bare"
                            >
                                {countdown.text}
                            </AuctionTimeDisplay>
                        </AuctionInfoRail>
                    </>
                }
                item={cardItem}
                action={<ItemCardActionSurface action={action} />}
            />
        </div>
    )
}

export default AuctionCard

