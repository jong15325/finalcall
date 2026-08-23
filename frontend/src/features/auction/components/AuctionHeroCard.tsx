import ItemFrame from '@/features/item/components/ItemFrame'
import { itemArt } from '@/features/item/lib/itemArt'
import {
    auctionPhaseLabelOf,
    type AuctionPhase,
} from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 경매 상세 히어로 카드 (FC-072 — 목업 `.auction-hero-card` 1:1 · design-brief B-3).
 *
 * 목업 구조: `245px 아트 | 1fr copy` 그리드(모바일 118px). 좌측 어두운 스테이지 + 공용 `ItemFrame`,
 * 우측 copy(상태 배지·카드정보 속성표·특수 스킬). 아이템 마켓 `CardInfoDialog` 의 정보 구조와
 * 앱 navy/gold/orange 팔레트를 따르되 모달 셸·초점 트랩은 재사용하지 않는다.
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

function AuctionHeroCard({ auction, phase, now }: AuctionHeroCardProps) {
    const { item } = auction
    const cardInfo = item.cardInfo
    if (!cardInfo) throw new Error('서버 카드정보 응답이 없습니다.')
    const art = itemArt(
        {
            subGroup: item.subGroup,
            kind: item.kind,
            element: item.element,
            level: item.level,
        },
        'l',
        3,
    )
    const skills = cardInfo.skills.filter((skill) => skill.code !== null)
    const hasSkill = skills.length > 0
    const typeLine = `${cardInfo.frame.label} - ${cardInfo.category.label}`

    return (
        <section className="detail-surface grid overflow-hidden rounded-2xl border border-content-line bg-content-surface md:grid-cols-[118px_minmax(0,1fr)] lg:h-full lg:grid-cols-[245px_minmax(0,1fr)]">
            {/* 아트 열 — 스프라이트 스테이지가 열 전체를 채우고 프레임을 가운데. lg 에서 2배 확대(§3·§5). */}
            <div className="relative min-h-[220px] lg:min-h-[390px]">
                <ItemFrame
                    fill
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={cardInfo.shortName}
                    frame={cardInfo.frame}
                    hasSkill={hasSkill}
                    size="stage"
                    now={now}
                    className="lg:[--art-scale:2]"
                />
            </div>

            {/* copy 열 */}
            <div className="flex flex-col p-5 lg:p-9">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${PHASE_BADGE_CLASS[phase]}`}
                    >
                        {auctionPhaseLabelOf(phase)}
                    </span>
                </div>

                <h2 className="mt-4 text-xl font-bold leading-tight text-content-fg lg:text-2xl">
                    카드정보{' '}
                    <small className="text-[10px] font-bold tracking-[0.12em] text-content-subtle">
                        CARD INFO
                    </small>
                </h2>

                <dl className="mt-4 border-t border-content-line">
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            타입
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {typeLine}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            명칭
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {cardInfo.formalName}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            채널제한
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {cardInfo.channelLimit.label}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            속성
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {cardInfo.element.label}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            남은 골드 포스
                        </dt>
                        <dd className="font-semibold tabular-nums text-content-fg">
                            {cardInfo.frame.remainingGoldforceDays}
                        </dd>
                    </div>
                </dl>

                <div className="mt-5 rounded-lg bg-content-soft p-4">
                    <h3 className="text-sm font-bold text-content-fg">
                        특수 스킬
                    </h3>
                    {skills.length > 0 ? (
                        <ul
                            className="mt-2 flex flex-col gap-2"
                            aria-label="특수 스킬"
                        >
                            {skills.map((skill) => {
                                return (
                                    <li
                                        key={skill.slot}
                                        className="flex min-w-0 items-start gap-2 py-1 text-sm"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="item-skill-label grid size-5 shrink-0 place-items-center rounded border border-content-line bg-content-surface text-xs font-bold"
                                        >
                                            {skill.slot}
                                        </span>
                                        <span className="item-skill-content min-w-0 break-words font-semibold">
                                            {skill.name}
                                            {skill.percent !== null && (
                                                <span className="item-skill-percent whitespace-nowrap font-extrabold">
                                                    ({skill.percent}%)
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="mt-2 py-2.5 text-sm text-content-subtle">
                            보유한 특수 스킬이 없습니다.
                        </p>
                    )}
                </div>
            </div>
        </section>
    )
}

export default AuctionHeroCard
