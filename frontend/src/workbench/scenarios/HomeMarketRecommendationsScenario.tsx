import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router'
import HomeMarketRecommendations from '@/features/home/components/HomeMarketRecommendations'
import ShopCardInfoDialog from '@/features/shop/components/ShopCardInfoDialog'
import { paths } from '@/app/paths'
import {
    homeMarketRecommendationsFixture,
    type HomeMarketRecommendationsFixture,
} from '../fixtures/homeMarketRecommendations'
import type { HomeMarketRecommendationsState } from '@/features/home/components/HomeMarketRecommendations'
import type { ShopSummary } from '@/lib/api/shop'
import type { WorkbenchFixture } from '../types'

// eslint-disable-next-line react-refresh/only-export-components
export const fixture = homeMarketRecommendationsFixture

const STATES = ['ready', 'partial', 'empty', 'loading', 'error'] as const
type PreviewState = (typeof STATES)[number]

export default function HomeMarketRecommendationsScenario({
    fixture: source,
}: {
    fixture: WorkbenchFixture
}) {
    const preview = source as HomeMarketRecommendationsFixture
    const location = useLocation()
    const requestedState = new URLSearchParams(location.search).get('state')
    const state: PreviewState = STATES.includes(requestedState as PreviewState)
        ? (requestedState as PreviewState)
        : 'ready'
    const [selectedShop, setSelectedShop] = useState<ShopSummary | null>(null)
    const openCardInfo = useCallback((shop: ShopSummary) => {
        setSelectedShop(shop)
    }, [])
    const componentState: HomeMarketRecommendationsState =
        state === 'partial' ? 'ready' : state
    const items =
        state === 'ready'
            ? preview.complete
            : state === 'partial'
              ? preview.partial
              : []

    return (
        <div
            data-home-market-recommendations-workbench
            className="flex w-full min-w-0 max-w-full flex-col gap-5"
        >
            <header className="flex min-w-0 flex-col gap-3 border-b border-content-line pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-content-fg">
                        홈 추천 마켓 디자인 게이트
                    </h1>
                    <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                        실제 AppShell과 ShopCard를 사용해 추천 근거, 카드 클릭,
                        비교, 구매 모달의 간섭 여부를 확인합니다.
                    </p>
                </div>
                <nav
                    aria-label="추천 마켓 상태"
                    className="flex flex-wrap gap-2"
                >
                    {STATES.map((option) => (
                        <Link
                            key={option}
                            to={`/__design/home-market-recommendations?state=${option}`}
                            aria-current={state === option ? 'page' : undefined}
                            className="inline-flex min-h-11 items-center rounded-lg border border-content-line bg-content-surface px-3 text-sm font-semibold text-content-muted hover:border-control-action hover:text-control-action aria-[current=page]:border-control-action aria-[current=page]:bg-control-action aria-[current=page]:text-control-action-ink"
                        >
                            {option}
                        </Link>
                    ))}
                </nav>
            </header>

            <HomeMarketRecommendations
                items={items}
                state={componentState}
                now={preview.now}
                onOpen={openCardInfo}
            />

            {selectedShop && (
                <ShopCardInfoDialog
                    shop={selectedShop}
                    now={preview.now}
                    balance={undefined}
                    isAuthed={false}
                    isOwn={false}
                    loginHref={paths.login}
                    onClose={() => setSelectedShop(null)}
                />
            )}
        </div>
    )
}
