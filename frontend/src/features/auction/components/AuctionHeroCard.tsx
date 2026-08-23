import CardInfoContent from '@/features/item/components/CardInfoContent'
import {
    auctionPhaseLabelOf,
    type AuctionPhase,
} from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 경매 상세 히어로 카드 (FC-072 — 목업 `.auction-hero-card` 1:1 · design-brief B-3).
 *
 * 카드정보 본문은 아이템 마켓 모달과 동일한 `CardInfoContent` 정본을 그대로 재사용한다.
 * 경매 고유 상태 배지만 본문 위에 두며, 입찰 영역은 이 컴포넌트의 범위가 아니다.
 *
 * ★ 명칭·축 라벨·스킬 2슬롯·골드포스 잔여일은 서버 `cardInfo`를 그대로 표시한다.
 * ★ 색은 브랜드 팔레트(navy/gold) — 목업 Vuexy 잔재색은 쓰지 않는다(§2.9).
 */

const PHASE_BADGE_CLASS: Record<AuctionPhase, string> = {
    live: 'bg-success-soft text-success-ink',
    scheduled: 'detail-meta bg-brand-structure/10 text-chrome-selected',
    ended: 'bg-content-soft text-content-subtle',
}

interface AuctionHeroCardProps {
    auction: AuctionDetail
    phase: AuctionPhase
    /** 기존 상세 카드 호출 계약과 단일 시계 주입 형상을 유지한다. */
    now: number
}

function AuctionHeroCard({ auction, phase }: AuctionHeroCardProps) {
    const { item } = auction
    const cardInfo = item.cardInfo
    if (!cardInfo) throw new Error('서버 카드정보 응답이 없습니다.')
    return (
        <section className="detail-surface card-info-content-shell h-full overflow-hidden rounded-2xl border border-content-line bg-content-surface p-5 lg:p-9">
            <div className="flex h-full flex-col">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PHASE_BADGE_CLASS[phase]}`}
                    >
                        {auctionPhaseLabelOf(phase)}
                    </span>
                </div>

                <h2 className="mb-5 mt-4 text-xl font-bold leading-tight text-content-fg lg:text-2xl">
                    카드정보{' '}
                    <small className="text-[10px] font-bold tracking-[0.12em] text-content-subtle">
                        CARD INFO
                    </small>
                </h2>

                <CardInfoContent
                    cardInfo={cardInfo}
                    subGroup={item.subGroup}
                    kind={item.kind}
                    element={item.element}
                    level={item.level}
                />
            </div>
        </section>
    )
}

export default AuctionHeroCard
