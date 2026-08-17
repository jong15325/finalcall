import type { WorkbenchFixture } from '../types'
import { AUCTION_COUNTDOWN_TAG_VARIANTS } from '../candidates/AuctionCountdownTagCandidate'

export interface AuctionCountdownTagsFixture extends WorkbenchFixture {
    variants: typeof AUCTION_COUNTDOWN_TAG_VARIANTS
}

export const auctionCountdownTagsFixture: AuctionCountdownTagsFixture = {
    variants: AUCTION_COUNTDOWN_TAG_VARIANTS,
    shellState: { authSession: null, unreadMemoCount: 0 },
}
