import { Link } from 'react-router'
import Card from '@/components/ui/Card'
import ItemArtSlot from '@/features/item/components/ItemArtSlot'
import ItemAttributeTags from '@/features/item/components/ItemAttributeTags'
import { buildPath } from '@/configs/routes.config'
import CountdownText from './CountdownText'
import {
    auctionPriceOf,
    bidCountLabelOf,
    formatGameMoney,
} from '../lib/auctionPrice'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 피처드 경매 카드 — 홈 최상단 1건 (FC-058).
 *
 * ★★ **스크롤 0px 에 실제 카운트다운이 있는 이유가 이 카드다.** 홈이 "실시간 경매 플랫폼"이라고
 *    **카피로 주장하지 않고**, 지금 가장 먼저 끝나는 경매의 남은 시간을 **데이터로 보여준다.**
 *    그래서 히어로 배너·슬로건이 없다.
 *
 * ★ 가로 배치다 — 아트를 크게(정수 3배 = 150×279) 두고 오른쪽에 정보를 쌓는다.
 *   아래 행목록·격자와 **구조가 달라야** 같은 리듬의 반복이 되지 않는다.
 *
 * ★ 시각은 전부 템플릿 — 면은 `Card`, 배지는 `Tag`, 타이포는 템플릿 gray 스케일.
 */

interface AuctionFeatureCardProps {
    auction: AuctionSummary
}

const AuctionFeatureCard = ({ auction }: AuctionFeatureCardProps) => {
    const { item } = auction
    const price = auctionPriceOf(auction)

    return (
        <Card
            className="h-full"
            bodyClass="flex h-full flex-col gap-5 sm:flex-row sm:items-center"
        >
            <ItemArtSlot
                item={item}
                scale={3}
                name={item.nameSnapshot}
                className="mx-auto p-4 sm:mx-0"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-2">
                    <h3 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">
                        <Link
                            to={buildPath.auctionDetail(
                                auction.auctionPublicId,
                            )}
                            className="hover:underline"
                        >
                            {item.nameSnapshot}
                        </Link>
                    </h3>
                    <ItemAttributeTags
                        subGroup={item.subGroup}
                        element={item.element}
                        kind={item.kind}
                        level={item.level}
                    />
                </div>

                {/*
                 * 남은 시간이 이 카드에서 가장 큰 활자다 — 홈의 주장을 대신하는 자리라
                 * 가격보다 앞에 온다.
                 */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs leading-none text-gray-500 dark:text-gray-400">
                        마감까지
                    </span>
                    <CountdownText endAt={auction.endAt} size="lg" />
                </div>

                <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div className="flex flex-col gap-1">
                        <dt className="text-xs leading-none text-gray-500 dark:text-gray-400">
                            {price.label}
                        </dt>
                        <dd className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            {formatGameMoney(price.amount)}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-xs leading-none text-gray-500 dark:text-gray-400">
                            입찰
                        </dt>
                        <dd className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            {bidCountLabelOf(auction.bidCount)}
                        </dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                        <dt className="text-xs leading-none text-gray-500 dark:text-gray-400">
                            판매자
                        </dt>
                        <dd className="truncate text-base text-gray-700 dark:text-gray-300">
                            {auction.sellerNickname}
                        </dd>
                    </div>
                </dl>
            </div>
        </Card>
    )
}

export default AuctionFeatureCard
