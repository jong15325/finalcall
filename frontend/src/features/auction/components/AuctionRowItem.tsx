import { Link } from 'react-router'
import ItemArtSlot from '@/features/item/components/ItemArtSlot'
import { buildPath } from '@/configs/routes.config'
import CountdownText from './CountdownText'
import { auctionPriceOf, formatGameMoney } from '../lib/auctionPrice'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 마감 임박 행 항목 — 피처드 아래에 이어지는 4건 (FC-058).
 *
 * ★ **격자가 아니라 행이다.** 여기서 사용자가 하는 일은 "고르기"가 아니라 **"훑기"** 다 —
 *   마감 순서대로 위에서 아래로 읽힌다. 격자로 만들면 순서가 지그재그가 되어 그 의미가 사라진다.
 *
 * ★ 아트는 정수 1배(50×93)로 작다 — 행 높이가 낮아야 5건이 한눈에 들어온다.
 *
 * ★ **배지 대신 한 줄 텍스트다.** 좁은 행에 `Tag` 3개를 넣으면 줄바꿈이 나거나 이름이 밀린다.
 *   색이 없어 어차피 글자가 정보이므로 `속성 · 종류 · 레벨`을 **가운뎃점으로 이어** 한 줄에 둔다
 *   (`ItemAttributeTags` 와 **내용은 같고 밀도만 다르다** — 접기가 아니라 다른 조판이다).
 */

interface AuctionRowItemProps {
    auction: AuctionSummary
}

const AuctionRowItem = ({ auction }: AuctionRowItemProps) => {
    const { item } = auction
    const price = auctionPriceOf(auction)

    return (
        <li>
            <Link
                to={buildPath.auctionDetail(auction.auctionPublicId)}
                className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
                <ItemArtSlot
                    item={item}
                    scale={1}
                    name={item.nameSnapshot}
                    className="p-1.5"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                        {item.nameSnapshot}
                    </span>
                    <span className="truncate text-xs text-gray-600 dark:text-gray-400">
                        {elementBadgeLabelOf(item.element)} ·{' '}
                        {itemTypeLabel(item.subGroup, item.kind)} · Lv.
                        {item.level}
                    </span>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                    <CountdownText endAt={auction.endAt} />
                    <span className="text-xs tabular-nums text-gray-600 dark:text-gray-400">
                        {price.label} {formatGameMoney(price.amount)}
                    </span>
                </div>
            </Link>
        </li>
    )
}

export default AuctionRowItem
