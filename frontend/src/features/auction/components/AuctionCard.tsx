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
import Countdown from './Countdown'
import type { AuctionSummary } from '@/lib/api/auctions'

/**
 * 경매 카드 — **가로형**(FC-071, 목업 `#auction` `.auction-card` 1:1).
 *
 * 목업 DOM/치수를 그대로 옮긴다: `112px | 1fr` 그리드(모바일 102px), 좌측 아트(공용 `ItemFrame`),
 * 우측 copy(상태배지·속성·#id·이름·메타·현재가/입찰·카운트다운/판매자). 카드 전체가 상세 링크다.
 *
 * ★ **아트는 공용 `ItemFrame`**(프레임·골드포스·스프라이트 규칙 유지) — `itemArt` 로 경로 파생.
 *   세로형 `ItemCard` 는 이 화면에서 쓰지 않는다(카드 형태가 다르다).
 * ★ **가격 = `highestBidAmount ?? startPrice`**, 라벨은 입찰 유무로 갈린다(현재가/시작가). 금액은
 *   `CodeAmount`(정수·코드 아이콘) — `G` 텍스트 단위 금지(§3.3).
 * ★ **상태·마감은 클라 파생**(`auctionPhaseOf`, `now>=endAt`) — 서버 status 불신. 카운트다운도 같은 `now`.
 * ★ 판매자는 `sellerNickname` 원문(마스킹 미결·§8) — 문자열 비교로 본인 판정하지 않는다.
 * ★ 색은 브랜드 토큰(navy/gold/gray) — 목업의 Vuexy 블루(#3867df 등)는 재구축에서 폐기된 팔레트라
 *   구조/치수만 목업을 따르고 색은 토큰으로 맞춘다(tailwind theme).
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

interface AuctionCardProps {
    auction: AuctionSummary
    /** 현재 시각(ms) — 목록이 단일 타이머로 주입 */
    now: number
}

function AuctionCard({ auction, now }: AuctionCardProps) {
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
            className="grid min-h-[218px] grid-cols-[102px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface transition-transform hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(37,57,88,0.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 xs:grid-cols-[112px_minmax(0,1fr)]"
        >
            {/* 아트 열 — 어두운 스테이지 + 공용 ItemFrame(72×134) */}
            <span className="grid place-items-center bg-navy-900">
                <ItemFrame
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.nameSnapshot}
                    visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                    hasSkill={hasSkill}
                    size="frame"
                    now={now}
                />
            </span>

            {/* copy 열 */}
            <span className="flex min-w-0 flex-col px-3 py-3.5 xs:p-[17px]">
                <span className="flex items-start justify-between gap-2">
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
                    <span className="shrink-0 text-[10px] text-gray-400">
                        #{auction.auctionPublicId.slice(-4)}
                    </span>
                </span>

                <span className="mb-1 mt-3.5 line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-tight text-gray-900">
                    {item.nameSnapshot}
                </span>
                <span className="truncate text-xs text-gray-500">
                    {item.specSnapshot} · Lv.{item.level}
                </span>

                <span className="my-3 grid grid-cols-[1fr_auto] gap-2.5 border-y border-line py-3">
                    <span className="grid gap-0.5">
                        <span className="text-[10px] text-gray-500">
                            {price.label}
                        </span>
                        <CodeAmount
                            value={price.amount}
                            mode="compact"
                            className="whitespace-nowrap text-[13px] font-bold text-gray-900"
                        />
                    </span>
                    <span className="grid justify-items-end gap-0.5">
                        <span className="text-[10px] text-gray-500">입찰</span>
                        <strong className="text-[13px] font-bold text-gray-900">
                            {auction.bidCount}회
                        </strong>
                    </span>
                </span>

                <span className="mt-auto flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <Countdown endAt={auction.endAt} now={now} />
                    <span className="min-w-0 truncate">
                        판매자 {auction.sellerNickname}
                    </span>
                </span>
            </span>
        </Link>
    )
}

export default AuctionCard
