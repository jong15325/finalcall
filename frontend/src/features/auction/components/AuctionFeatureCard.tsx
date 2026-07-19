import { Link } from 'react-router'
import { PiGavelDuotone } from 'react-icons/pi'
import Card from '@/components/ui/Card'
import ItemArtSlot from '@/features/item/components/ItemArtSlot'
import GoldforceChip from '@/features/item/components/GoldforceChip'
import { isGoldforceActive } from '@/features/item/lib/goldforce'
import { buildPath } from '@/configs/routes.config'
import CountdownText from './CountdownText'
import UrgencyBadge from './UrgencyBadge'
import { CARD_INTERACTION_CLASS } from './interactionClass'
import {
    auctionPriceOf,
    bidCountLabelOf,
    formatGameMoney,
} from '../lib/auctionPrice'
import { useNow } from '../lib/useNow'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 마감 임박 카드 — **통합된 단일 영역의 슬라이드** (FC-058 재작업 2차).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **피처드/행목록 이원 구조를 없앴다** (사용자 지시: *"하나의 영역인 거지"*).
 * ══════════════════════════════════════════════════════════════════════════════
 * 종전에는 1건만 큰 카드(피처드), 나머지는 작은 행(대기열)이라 **한 섹션에 두 덩어리**였다.
 * 이제 **모든 마감 임박 매물이 같은 카드로 같은 캐러셀 안에서** 흐른다.
 * 순서(급한 정도)는 **크기 차이가 아니라 슬라이드 순서**가 표현한다 — 왼쪽이 가장 급하다.
 *
 * 그 대신 **각 카드 안에서 위계를 세운다**(피드백 7 "마감 임박처럼"):
 *   상태 배지 → **카운트다운(카드 최대 활자)** → 이름 → 가격.
 * 남은 시간이 이름보다 위·크게 온다. 이 섹션에서 답해야 할 질문이 "얼마 남았나"이기 때문이다.
 *
 * ★ 밀도(피드백 6): 속성·종류·레벨 태그 삭제(사용자 지시, 정보는 이름·`alt`·레벨 칩에 남음),
 *   **판매자 제거**(훑을 때 필요한 정보가 아니다 — 상세로 옮긴다).
 *   입찰 건수는 남긴다 — **경쟁 강도가 급박함의 진짜 근거**이기 때문이다(가짜 긴급성이 아니다).
 *
 * ★ **가로 배치**(아트 왼쪽 · 정보 오른쪽)라 아래 "새 매물" 격자의 세로 카드와 구분된다 —
 *   섹션마다 구조가 달라야 스크롤에 의미가 생긴다.
 */

interface AuctionFeatureCardProps {
    auction: AuctionSummary
}

const AuctionFeatureCard = ({ auction }: AuctionFeatureCardProps) => {
    const now = useNow()
    const { item } = auction
    const price = auctionPriceOf(auction)
    const goldforce = isGoldforceActive(item.goldforceExpireAt, now)

    return (
        <Link
            to={buildPath.auctionDetail(auction.auctionPublicId)}
            className={CARD_INTERACTION_CLASS}
        >
            <Card
                clickable
                className="h-full"
                bodyClass="flex h-full items-center gap-3 sm:gap-4"
            >
                {/*
                 * ★ 좁은 화면에서 아트를 1배로 낮춘다. 2배(100px)면 320px 화면의 카드 내부
                 *   248px 중 134px 을 아트가 먹어 정보열이 98px 로 무너진다(실측).
                 *   1배면 80px 이라 정보열이 152px 남는다. **링 두께도 같이 줄어** 비율이 유지된다.
                 */}
                <ItemArtSlot
                    showLevel
                    item={item}
                    scale={2}
                    scaleNarrow={1}
                    name={item.nameSnapshot}
                    goldforce={goldforce}
                    className="p-2 sm:p-3"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
                        <UrgencyBadge endAt={auction.endAt} />
                        {goldforce && <GoldforceChip />}
                    </div>

                    {/* 카드에서 가장 큰 활자 — 섹션의 주장이 여기 실린다. */}
                    <CountdownText endAt={auction.endAt} size="hero" />

                    <h3 className="truncate text-sm font-bold text-gray-900 group-hover:underline dark:text-gray-100">
                        {item.nameSnapshot}
                    </h3>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2">
                            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                {price.label}
                            </span>
                            <span className="truncate text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
                                {formatGameMoney(price.amount)}
                            </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                            <PiGavelDuotone aria-hidden="true" />
                            {bidCountLabelOf(auction.bidCount)}
                        </span>
                    </div>
                </div>
            </Card>
        </Link>
    )
}

export default AuctionFeatureCard
