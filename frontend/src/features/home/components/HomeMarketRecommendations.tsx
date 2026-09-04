import { TbBuildingStore } from 'react-icons/tb'
import ListFrame from '@/components/common/ListFrame'
import { HomeSectionHeading } from './HomeSection'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import ShopCard from '@/features/shop/components/ShopCard'
import { paths } from '@/app/paths'
import type { ShopRecommendationItem, ShopSummary } from '@/lib/api/shop'

export type HomeMarketRecommendationsState =
    'loading' | 'error' | 'empty' | 'ready'

interface HomeMarketRecommendationsProps {
    items: readonly ShopRecommendationItem[]
    state: HomeMarketRecommendationsState
    now: number
    onOpen: (shop: ShopSummary) => void
    onRetry?: () => void
}

export default function HomeMarketRecommendations({
    items,
    state,
    now,
    onOpen,
    onRetry = () => undefined,
}: HomeMarketRecommendationsProps) {
    const frameState =
        state === 'loading'
            ? ({ kind: 'loading', count: 6 } as const)
            : state === 'error'
              ? ({
                    kind: 'error',
                    message: '추천 매물을 불러오지 못했어요.',
                    onRetry,
                } as const)
              : state === 'empty'
                ? ({
                      kind: 'empty',
                      title: '지금 추천할 수 있는 매물이 없어요',
                      description:
                          '새 매물이 등록되면 이곳에서 바로 알려드릴게요.',
                  } as const)
                : ({ kind: 'ready' } as const)

    return (
        <section data-home-market-recommendations>
            <ListFrame
                heading={
                    <HomeSectionHeading
                        icon={TbBuildingStore}
                        title="오늘의 추천 마켓"
                        description="새 매물부터 판매 종료가 가까운 아이템까지 골라봤어요."
                        seeAllHref={paths.market}
                    />
                }
                state={frameState}
                layout="catalog"
                as="ul"
                label="오늘의 추천 마켓 목록"
                renderSkeleton={(index) => (
                    <li className="min-w-0">
                        <ItemListSkeleton key={index} layout="preview" />
                    </li>
                )}
            >
                {items.map(({ shop }) => (
                    <li key={shop.shopPublicId} className="min-w-0">
                        <ShopCard shop={shop} now={now} onOpen={onOpen} />
                    </li>
                ))}
            </ListFrame>
        </section>
    )
}
