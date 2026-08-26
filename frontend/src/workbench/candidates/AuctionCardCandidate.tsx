import { auctionDetailPath } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import ItemCardActionSurface from '@/features/item/components/ItemCardActionSurface'
import ItemCardView, {
    ItemCardArtwork,
} from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import {
    auctionPhaseLabelOf,
    auctionPhaseOf,
} from '@/features/auction/lib/auctionPhase'
import {
    auctionPriceOf,
    bidCountBadgeLabelOf,
} from '@/features/auction/lib/auctionPrice'
import Countdown from '@/features/auction/components/Countdown'
import type { AuctionSummary } from '@/lib/api/auctions'

const phaseTagClasses = {
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

const tagStyle = { gap: 5, padding: '3px 7px', borderRadius: 999 } as const
const tagDotStyle = { width: 7, height: 7, borderRadius: '50%' } as const

export default function AuctionCardCandidate({
    auction,
    now,
}: {
    auction: AuctionSummary
    now: number
}) {
    const phase = auctionPhaseOf(auction, now)
    const price = auctionPriceOf(auction)
    const item = toItemCardViewModel(auction.item, now)
    const cardItem = {
        ...item,
        seller: undefined,
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

    return (
        <div
            className="relative h-full min-w-0"
            data-auction-card-candidate={auction.auctionPublicId}
        >
            <ItemCardView
                fullHeight
                density="compact"
                artwork={
                    <div
                        className="item-card__artwork-composition relative"
                        data-artwork-height="208"
                        data-market-artwork-height="208"
                        style={{ height: 208 }}
                    >
                        <ItemCardArtwork item={item} mode="fill" scale={1.35} />
                        <span
                            data-auction-badge-row
                            className="pointer-events-none absolute top-2 grid min-w-0 gap-1"
                            style={{
                                left: 8,
                                right: 8,
                                gridTemplateColumns:
                                    'minmax(0, auto) minmax(0, 1fr)',
                            }}
                        >
                            <span
                                data-auction-phase-badge
                                className={`inline-flex shrink-0 items-center whitespace-nowrap text-[10px] font-extrabold ${phaseTagClasses[phase].badge}`}
                                style={tagStyle}
                            >
                                <span
                                    data-auction-phase-dot
                                    style={tagDotStyle}
                                    aria-hidden="true"
                                    className={`shrink-0 ${phaseTagClasses[phase].dot}`}
                                />
                                <span>{auctionPhaseLabelOf(phase)}</span>
                            </span>
                            <span
                                data-auction-bid-badge
                                aria-label={bidLabel.full}
                                className="inline-flex min-w-0 items-center bg-brand-highlight-soft font-mono text-[10px] font-extrabold tabular-nums text-brand-highlight-deep"
                                title={bidLabel.full}
                                style={{
                                    ...tagStyle,
                                    justifySelf: 'end',
                                    maxWidth: '100%',
                                }}
                            >
                                <span
                                    data-auction-bid-dot
                                    style={tagDotStyle}
                                    aria-hidden="true"
                                    className="shrink-0 bg-brand-highlight-bright"
                                />
                                <span
                                    data-auction-bid-text
                                    className="min-w-0 break-all text-right leading-tight"
                                >
                                    {bidLabel.visible}
                                </span>
                            </span>
                        </span>
                        <ItemCardActionSurface
                            area="artwork"
                            keyboard={false}
                            action={action}
                        />
                    </div>
                }
                item={cardItem}
                action={<ItemCardActionSurface action={action} />}
                footer={
                    <div className="grid min-w-0 gap-2 px-1 py-1 text-xs">
                        <div className="min-w-0">
                            <span className="text-content-muted">
                                {price.label}
                            </span>
                            <CodeAmount
                                value={price.amount}
                                mode="full"
                                className="mt-1 max-w-full min-w-0 flex-wrap break-all text-sm font-bold text-content-fg"
                            />
                        </div>
                        <Countdown endAt={auction.endAt} now={now} />
                        <p className="flex min-w-0 gap-1.5 border-t border-content-line py-2 text-content-muted">
                            <span className="shrink-0">판매자</span>
                            <strong
                                className="min-w-0 truncate text-content-fg"
                                title={auction.sellerNickname}
                            >
                                {auction.sellerNickname}
                            </strong>
                        </p>
                    </div>
                }
            />
        </div>
    )
}
