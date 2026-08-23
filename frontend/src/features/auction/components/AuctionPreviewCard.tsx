import { auctionDetailPath } from '@/app/paths'
import ItemCardActionSurface from '@/features/item/components/ItemCardActionSurface'
import ItemCardView, {
    ItemCardArtwork,
} from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import {
    auctionPhaseOf,
    type AuctionPhase,
} from '@/features/auction/lib/auctionPhase'
import { auctionPriceOf } from '@/features/auction/lib/auctionPrice'
import CardCompareOverlay from '@/features/item/components/CardCompareOverlay'
import Countdown from './Countdown'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 프리뷰용 **세로형** 경매 카드 — 목업 `#home` `.home-recommend-card` 1:1.
 *
 * ★ 경매 목록의 **가로형** `AuctionCard` 와 형태가 다르다(목업 정본, rebuild-contract-map §1).
 *   홈 추천행은 아트가 위, copy 가 아래인 세로 카드다 — 그래서 별도 컴포넌트로 둔다.
 * ★ **아트는 공용 `ItemFrame`**(프레임·골드포스·스프라이트 규칙 유지) — `itemArt` 로 경로 파생.
 * ★ **가격 = `highestBidAmount ?? startPrice`**, 라벨은 입찰 유무로 갈린다(`auctionPriceOf`).
 *   금액은 `CodeAmount`(정수·텍스트 단위) — 축약 화폐 별칭 금지(§3.3).
 * ★ **상태·마감은 클라 파생**(`auctionPhaseOf`, `now>=endAt`) — 서버 status 불신. 카운트다운도 같은 `now`.
 * ★ `now` 는 밖(홈 섹션)이 **단일 타이머**로 주입한다 — 카드마다 타이머를 걸지 않는다.
 * ★ 색은 브랜드 토큰(navy/gold/gray). 목업의 Vuexy 블루는 재구축 폐기 팔레트라 구조만 따른다(§2.9).
 */

const PHASE_BADGE_CLASS: Record<AuctionPhase, string> = {
    live: 'bg-success-soft text-success-ink',
    scheduled: 'bg-brand-highlight-soft text-brand-highlight-deep',
    ended: 'bg-content-soft text-content-subtle',
}

const PHASE_LABEL: Record<AuctionPhase, string> = {
    live: '진행 중',
    scheduled: '예약',
    ended: '마감',
}

interface AuctionPreviewCardProps {
    auction: AuctionSummary
    /** 현재 시각(ms) — 홈 섹션이 단일 타이머로 주입 */
    now: number
}

function AuctionPreviewCard({ auction, now }: AuctionPreviewCardProps) {
    const { item } = auction
    const cardInfo = item.cardInfo
    const phase = auctionPhaseOf(
        {
            status: auction.status,
            startAt: auction.startAt,
            endAt: auction.endAt,
        },
        now,
    )
    const price = auctionPriceOf(auction)
    const viewModel = toItemCardViewModel(item, now, { price })
    const action = {
        kind: 'link' as const,
        to: auctionDetailPath(auction.auctionPublicId),
        label: `${cardInfo.shortName} 경매 상세 보기`,
    }
    const controlGapAction = (
        <ItemCardActionSurface
            area="control-gap"
            keyboard={false}
            action={action}
        />
    )

    return (
        <div className="home-recommend-card relative transition-transform hover:-translate-y-[3px]">
            <ItemCardView
                density="preview"
                item={viewModel}
                artwork={
                    <div className="item-card__artwork-composition">
                        <ItemCardArtwork item={viewModel} mode="preview" />
                        <div className="item-card__artwork-controls">
                            <div className="item-card__control-gap">
                                {controlGapAction}
                            </div>
                            <div
                                className="item-card__secondary-actions"
                                data-card-hit-area="compare"
                            >
                                <CardCompareOverlay
                                    listingId={auction.auctionPublicId}
                                    name={cardInfo.shortName}
                                />
                            </div>
                        </div>
                        <ItemCardActionSurface
                            area="artwork"
                            keyboard={false}
                            action={action}
                        />
                    </div>
                }
                action={<ItemCardActionSurface action={action} />}
                hoverShadow="preview"
                meta={
                    <span className="flex items-center gap-1.5">
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PHASE_BADGE_CLASS[phase]}`}
                        >
                            {PHASE_LABEL[phase]}
                        </span>
                        <span className="text-[10px] font-semibold uppercase text-content-subtle">
                            {cardInfo.element.label}
                        </span>
                    </span>
                }
                trailing={<Countdown endAt={auction.endAt} now={now} />}
            />
        </div>
    )
}

export default AuctionPreviewCard
