import { Link } from 'react-router'
import { PiGavelDuotone } from 'react-icons/pi'
import Card from '@/components/ui/Card'
import ItemArtSlot from '@/features/item/components/ItemArtSlot'
import GoldforceChip from '@/features/item/components/GoldforceChip'
import { isGoldforceActive } from '@/features/item/lib/goldforce'
import { buildPath } from '@/configs/routes.config'
import CountdownText from './CountdownText'
import { CARD_INTERACTION_CLASS } from './interactionClass'
import {
    auctionPriceOf,
    bidCountLabelOf,
    formatGameMoney,
} from '../lib/auctionPrice'
import { useNow } from '../lib/useNow'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 격자 경매 카드 — 새 매물 섹션 (FC-058 → 재작업).
 *
 * ★ **세로 배치**다(피처드는 가로, 대기열은 행). 여기서 하는 일은 훑기가 아니라 **고르기**라
 *   아트가 크고 나란히 비교된다.
 *
 * ★★ **태그 3개를 지우고 아트를 키웠다.** 카드 높이는 그대로인데 그림이 커져
 *    격자가 "아이템 진열장"으로 읽힌다 — 회색 알약이 줄줄이 서 있을 때는 카드가
 *    **아트가 아니라 태그를 진열**하고 있었다.
 *    속성·종류는 이름이, 레벨은 아트 위 칩이 말한다(정보 손실 없음).
 *
 * ★ 카드 전체가 링크다 — 좁은 화면에서 이름만 누르게 하면 표적이 작다.
 *   이름을 **별도 링크로 두지 않는 것**이 중요하다(중첩 링크는 접근성 위반).
 */

interface AuctionGridCardProps {
    auction: AuctionSummary
}

const AuctionGridCard = ({ auction }: AuctionGridCardProps) => {
    const now = useNow()
    const { item } = auction
    const price = auctionPriceOf(auction)
    const goldforce = isGoldforceActive(item.goldforceExpireAt, now)

    return (
        <li className="h-full">
            <Link
                to={buildPath.auctionDetail(auction.auctionPublicId)}
                className={CARD_INTERACTION_CLASS}
            >
                <Card
                    clickable
                    className="h-full"
                    bodyClass="flex h-full flex-col gap-3"
                >
                    <ItemArtSlot
                        showLevel
                        item={item}
                        scale={2}
                        name={item.nameSnapshot}
                        goldforce={goldforce}
                        className="w-full p-4"
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <h3 className="truncate text-sm font-bold text-gray-900 group-hover:underline dark:text-gray-100">
                            {item.nameSnapshot}
                        </h3>
                        {goldforce && <GoldforceChip className="self-start" />}
                    </div>

                    <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-3 dark:border-gray-600">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {price.label}
                            </span>
                            <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                                {formatGameMoney(price.amount)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                                <PiGavelDuotone aria-hidden="true" />
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
