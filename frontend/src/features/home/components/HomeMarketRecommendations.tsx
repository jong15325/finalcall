import {
    TbBuildingStore,
    TbClockHour4,
    TbRosetteDiscountCheck,
    TbSparkles,
} from 'react-icons/tb'
import ListFrame from '@/components/common/ListFrame'
import { HomeSectionHeading } from './HomeSection'
import ItemListSkeleton from '@/features/item/components/ItemListSkeleton'
import ShopCard from '@/features/shop/components/ShopCard'
import { paths } from '@/app/paths'
import type { ComponentType } from 'react'
import type {
    ShopRecommendationItem,
    ShopRecommendationReason,
    ShopSummary,
} from '@/lib/api/shop'

export type HomeMarketRecommendationsState =
    'loading' | 'error' | 'empty' | 'ready'

interface HomeMarketRecommendationsProps {
    items: readonly ShopRecommendationItem[]
    state: HomeMarketRecommendationsState
    now: number
    onOpen: (shop: ShopSummary) => void
    onRetry?: () => void
}

const REASON_VIEW: Record<
    ShopRecommendationReason,
    {
        label: string
        icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
        className: string
    }
> = {
    NEW: {
        label: '방금 등록',
        icon: TbSparkles,
        className: 'bg-info-soft text-info',
    },
    ENDING_SOON: {
        label: '24시간 내 판매 종료',
        icon: TbClockHour4,
        className: 'bg-warning-soft text-warning',
    },
    TRUSTED_SELLER: {
        label: '완료 판매 5회 이상',
        icon: TbRosetteDiscountCheck,
        className: 'bg-brand-highlight-soft text-brand-highlight-deep',
    },
    GENERAL: {
        label: '새 매물',
        icon: TbBuildingStore,
        className: 'bg-content-soft text-content-muted',
    },
}

export function RecommendationReason({
    reason,
}: {
    reason: ShopRecommendationReason
}) {
    const view = REASON_VIEW[reason]
    const Icon = view.icon

    return (
        <span
            data-recommendation-reason={reason}
            className={`pointer-events-none inline-flex min-h-7 w-fit max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-4 ${view.className}`}
        >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{view.label}</span>
        </span>
    )
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
                    <li className="flex min-w-0 flex-col gap-2">
                        <span
                            aria-hidden
                            className="h-7 w-24 animate-pulse rounded-full bg-content-soft"
                        />
                        <ItemListSkeleton key={index} layout="preview" />
                    </li>
                )}
            >
                {items.map(({ reason, shop }) => (
                    <li
                        key={shop.shopPublicId}
                        className="flex min-w-0 flex-col gap-2"
                    >
                        <RecommendationReason reason={reason} />
                        <ShopCard shop={shop} now={now} onOpen={onOpen} />
                    </li>
                ))}
            </ListFrame>
        </section>
    )
}
