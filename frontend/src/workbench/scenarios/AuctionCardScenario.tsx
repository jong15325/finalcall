import { ListGrid } from '@/components/common/ListFrame'
import AuctionCardCandidate from '../candidates/AuctionCardCandidate'
import {
    auctionCardFixture,
    type AuctionCardFixture,
} from '../fixtures/auctionCard'
import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = auctionCardFixture

export default function AuctionCardScenario({
    fixture: source,
}: {
    fixture: WorkbenchFixture
}) {
    const preview = source as AuctionCardFixture

    return (
        <div
            className="w-full min-w-0 max-w-full"
            data-testid="auction-card-scenario"
        >
            <header className="mb-5 min-w-0">
                <h1 className="text-2xl font-bold text-content-fg">
                    경매 목록 세로 카드 디자인 게이트
                </h1>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                    실제 AppShell과 공용 아이템 카드 composition으로
                    상태·가격·스킬·비교 상호작용을 함께 검증합니다.
                </p>
            </header>
            <ListGrid layout="catalog" label="경매 카드 후보">
                {preview.auctions.map((auction) => (
                    <AuctionCardCandidate
                        key={auction.auctionPublicId}
                        auction={auction}
                        now={preview.now}
                    />
                ))}
            </ListGrid>
        </div>
    )
}
