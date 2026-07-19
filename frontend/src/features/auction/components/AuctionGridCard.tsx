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
 * 격자 경매 카드 — 새 매물 섹션 (FC-058).
 *
 * ★ **세로 배치**다(피처드는 가로, 임박은 행). 여기서 사용자가 하는 일은 **훑기가 아니라
 *   고르기**라 아트가 크고 나란히 비교된다.
 *
 * ★ 카드 전체가 링크다 — 좁은 화면에서 이름만 누르게 하면 표적이 작다.
 *   그래도 **이름은 별도 링크로 두지 않는다**(중첩 링크는 접근성 위반). `Card` 를 링크가 감싼다.
 *
 * ★ 시각은 전부 템플릿 `Card` — 그림자·테두리·모서리를 직접 그리지 않는다.
 */

interface AuctionGridCardProps {
    auction: AuctionSummary
}

const AuctionGridCard = ({ auction }: AuctionGridCardProps) => {
    const { item } = auction
    const price = auctionPriceOf(auction)

    return (
        <li className="h-full">
            <Link
                to={buildPath.auctionDetail(auction.auctionPublicId)}
                className="block h-full rounded-xl focus-visible:outline focus-visible:outline-2"
            >
                <Card
                    clickable
                    className="h-full"
                    bodyClass="flex h-full flex-col gap-3"
                >
                    <ItemArtSlot
                        item={item}
                        scale={2}
                        name={item.nameSnapshot}
                        className="w-full p-4"
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <h3 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                            {item.nameSnapshot}
                        </h3>
                        <ItemAttributeTags
                            subGroup={item.subGroup}
                            element={item.element}
                            kind={item.kind}
                            level={item.level}
                        />
                    </div>

                    <div className="flex flex-col gap-1 border-t border-gray-200 pt-3 dark:border-gray-600">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {price.label}
                            </span>
                            <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                                {formatGameMoney(price.amount)}
                            </span>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {bidCountLabelOf(auction.bidCount)}
                            </span>
                            <CountdownText endAt={auction.endAt} />
                        </div>
                    </div>
                </Card>
            </Link>
        </li>
    )
}

export default AuctionGridCard
