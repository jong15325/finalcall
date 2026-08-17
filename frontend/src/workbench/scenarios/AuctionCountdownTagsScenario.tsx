import {
    AuctionTimeCatalog,
    AuctionTimeShowcase,
} from '@/components/common/AuctionTimeDisplay'
import { ItemCardArtwork as Artwork } from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import AuctionCountdownTagCandidate from '../candidates/AuctionCountdownTagCandidate'
import {
    auctionCountdownTagsFixture,
    type AuctionCountdownTagsFixture,
} from '../fixtures/auctionCountdownTags'
import { auctionCardFixture } from '../fixtures/auctionCard'
import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = auctionCountdownTagsFixture

const previewItem = toItemCardViewModel(
    auctionCardFixture.auctions[0].item,
    auctionCardFixture.now,
)

export default function AuctionCountdownTagsScenario({
    fixture: source,
}: {
    fixture: WorkbenchFixture
}) {
    const preview = source as AuctionCountdownTagsFixture

    return (
        <AuctionTimeShowcase data-testid="auction-countdown-tags-scenario">
            <header className="mb-5 min-w-0">
                <h1 className="text-2xl font-bold text-content-fg">
                    경매 시간 표시 12안
                </h1>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                    시간은 읽기 전용 데이터로, 경매 상태만 badge로 구분합니다.
                    미니 타임코드·경매 정보 레일·상태/시간 분리 세 계열을 실제
                    artwork에서 비교합니다.
                </p>
            </header>
            <aside className="mb-5 max-w-full break-words rounded-xl border border-content-line bg-content-surface p-4 text-sm leading-6 text-content-muted">
                <strong className="text-content-fg">조사 결론</strong>
                <p>
                    Atlassian은 status lozenge와 count badge 역할을 분리하고,
                    Carbon은 compact read-only 정보를 권장합니다. NFT 경매
                    카드는 timer를 장식 태그보다 거래 데이터로 다룹니다.
                </p>
            </aside>
            <AuctionTimeCatalog aria-label="경매 시간 표시 후보">
                {preview.variants.map((variant) => (
                    <article
                        key={variant.id}
                        className="min-w-0 overflow-hidden rounded-xl border border-content-line bg-content-surface"
                    >
                        <div className="relative h-48 overflow-hidden bg-content-soft">
                            <Artwork item={previewItem} mode="fill" />
                            <AuctionCountdownTagCandidate variant={variant} />
                        </div>
                        <div className="min-w-0 p-3">
                            <p className="text-xs font-semibold text-brand-highlight-deep">
                                계열 {variant.family}
                            </p>
                            <h2 className="mt-1 text-sm font-bold leading-5 text-content-fg">
                                {variant.number}. {variant.name}
                            </h2>
                            <details className="mt-2 text-xs leading-5 text-content-muted">
                                <summary className="min-h-11 cursor-pointer py-3 font-semibold text-content-fg">
                                    설계 근거 보기
                                </summary>
                                <dl className="grid gap-1 pb-1">
                                    <Meta
                                        label="구조"
                                        value={variant.structure}
                                    />
                                    <Meta
                                        label="레퍼런스"
                                        value={variant.reference}
                                    />
                                    <Meta
                                        label="선정 이유"
                                        value={variant.rationale}
                                    />
                                </dl>
                            </details>
                        </div>
                    </article>
                ))}
            </AuctionTimeCatalog>
        </AuctionTimeShowcase>
    )
}

function Meta({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-1">
            <dt className="shrink-0 font-semibold text-content-fg">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
        </div>
    )
}
