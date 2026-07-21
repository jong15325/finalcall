import { Link } from 'react-router'
import { auctionDetailPath } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import ItemFrame from '@/features/item/components/ItemFrame'
import { elementLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import {
    auctionPhaseOf,
    type AuctionPhase,
} from '@/features/auction/lib/auctionPhase'
import { auctionPriceOf } from '@/features/auction/lib/auctionPrice'
import CardCompareOverlay from './CardCompareOverlay'
import Countdown from './Countdown'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 홈 프리뷰용 **세로형** 경매 카드 — 목업 `#home` `.home-recommend-card` 1:1.
 *
 * ★ 경매 목록의 **가로형** `AuctionCard` 와 형태가 다르다(목업 정본, rebuild-contract-map §1).
 *   홈 추천행은 아트가 위, copy 가 아래인 세로 카드다 — 그래서 별도 컴포넌트로 둔다.
 * ★ **아트는 공용 `ItemFrame`**(프레임·골드포스·스프라이트 규칙 유지) — `itemArt` 로 경로 파생.
 * ★ **가격 = `highestBidAmount ?? startPrice`**, 라벨은 입찰 유무로 갈린다(`auctionPriceOf`).
 *   금액은 `CodeAmount`(정수·코드 아이콘) — `G` 텍스트 단위 금지(§3.3).
 * ★ **상태·마감은 클라 파생**(`auctionPhaseOf`, `now>=endAt`) — 서버 status 불신. 카운트다운도 같은 `now`.
 * ★ `now` 는 밖(홈 섹션)이 **단일 타이머**로 주입한다 — 카드마다 타이머를 걸지 않는다.
 * ★ 색은 브랜드 토큰(navy/gold/gray). 목업의 Vuexy 블루는 재구축 폐기 팔레트라 구조만 따른다(§2.9).
 */

const PHASE_BADGE_CLASS: Record<AuctionPhase, string> = {
    live: 'bg-success-subtle text-success',
    scheduled: 'bg-navy/10 text-navy-700',
    ended: 'bg-gray-100 text-gray-500',
}

const PHASE_LABEL: Record<AuctionPhase, string> = {
    live: '진행 중',
    scheduled: '예약',
    ended: '마감',
}

interface AuctionPreviewCardProps {
    auction: AuctionSummary
    /** 현재 시각(ms) — 홈 섹션이 단일 타이머로 주입 */
    now: number
}

function AuctionPreviewCard({ auction, now }: AuctionPreviewCardProps) {
    const { item } = auction
    const phase = auctionPhaseOf(
        {
            status: auction.status,
            startAt: auction.startAt,
            endAt: auction.endAt,
        },
        now,
    )
    const price = auctionPriceOf(auction)
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        1,
    )
    const hasSkill = item.skill1 !== null || item.skill2 !== null

    return (
        <Link
            to={auctionDetailPath(auction.auctionPublicId)}
            aria-label={`${item.nameSnapshot} 경매 상세 보기`}
            className="home-recommend-card flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-transform hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(37,57,88,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
            {/* 아트 — 어두운 스테이지 + 공용 ItemFrame(72×134) */}
            <span className="grid place-items-center bg-navy-900 py-2.5">
                <ItemFrame
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.nameSnapshot}
                    visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                    hasSkill={hasSkill}
                    size="frame"
                    now={now}
                    overlay={
                        <CardCompareOverlay
                            listingId={auction.auctionPublicId}
                            name={item.nameSnapshot}
                        />
                    }
                />
            </span>

            {/* copy */}
            <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                <span className="flex items-center gap-1.5">
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PHASE_BADGE_CLASS[phase]}`}
                    >
                        {PHASE_LABEL[phase]}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-gray-500">
                        {elementLabelOf(item.element)}
                    </span>
                </span>

                <span className="line-clamp-2 min-h-[2.6em] text-[13px] font-bold leading-tight text-gray-900 xs:text-sm">
                    {item.nameSnapshot}
                </span>

                <span className="mt-auto flex items-baseline gap-1.5 whitespace-nowrap pt-1">
                    <span className="text-[11px] text-gray-400">
                        {price.label}
                    </span>
                    <CodeAmount
                        value={price.amount}
                        mode="compact"
                        className="text-[13px] font-bold text-gray-900 xs:text-sm"
                    />
                </span>

                <Countdown endAt={auction.endAt} now={now} />
            </span>
        </Link>
    )
}

export default AuctionPreviewCard
