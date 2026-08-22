import ItemFrame from '@/features/item/components/ItemFrame'
import {
    goldforceRemainingDays,
    resolveFrameType,
} from '@/features/item/components/frame'
import {
    resolveSkillSlots,
    skillLabelOf,
} from '@/features/item/components/skillSlots'
import { elementLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import { subGroupLabelOf } from '@/features/item/lib/itemCode'
import { channelLimitOf } from '@/features/item/lib/channelLimit'
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
 * ★ **스킬명은 item 블록의 skill1Name/skill2Name 으로 표시**(계약 §3.3 델타 — EPIC-MARKET-DATA).
 *   이름이 없으면 `스킬 #{code}` 중립 표기로 폴백한다. 슬롯 번호는 `resolveSkillSlots` 가 먼저
 *   매기고 걸러 마법(subGroup 3, skill1 부재)이 "스킬 1" 로 오표기되지 않는다(FC-064 함정 4).
 *   퍼센트는 원본 슬롯 2에만 병기한다.
 * ★ **골드포스 잔여일은 클라 파생**(서버는 만료 시각만)해 속성표에 표시한다.
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
    /** 현재 시각(ms) — 골드포스 잔여일 파생용(단일 타이머 주입) */
    now: number
}

function AuctionHeroCard({ auction, phase, now }: AuctionHeroCardProps) {
    const { item } = auction
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
    const skills = resolveSkillSlots(item.skill1, item.skill2, {
        skill1Name: item.skill1Name,
        skill2Name: item.skill2Name,
    })
    const hasSkill = skills.length > 0
    const goldforceDays = goldforceRemainingDays(item.goldforceExpireAt, now)
    const frameType = resolveFrameType(
        { goldforceExpireAt: item.goldforceExpireAt },
        now,
    )
    const typeLine = `${frameType === 'GOLDFORCE' ? '골드' : '블랙'} - ${subGroupLabelOf(item.subGroup)}`
    const channelLimit = channelLimitOf(item.level)

    return (
        <section className="detail-surface grid overflow-hidden rounded-2xl border border-content-line bg-content-surface md:grid-cols-[118px_minmax(0,1fr)] lg:grid-cols-[245px_minmax(0,1fr)]">
            {/* 아트 열 — 스프라이트 스테이지가 열 전체를 채우고 프레임을 가운데. lg 에서 2배 확대(§3·§5). */}
            <div className="relative min-h-[220px] lg:min-h-[390px]">
                <ItemFrame
                    fill
                    imageUrl={art?.src}
                    spriteUrl={art?.src}
                    name={item.nameSnapshot}
                    visual={{ goldforceExpireAt: item.goldforceExpireAt }}
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
                            {item.nameSnapshot}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            채널제한
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {channelLimit}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            속성
                        </dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-content-fg">
                            {elementLabelOf(item.element)}
                        </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-b border-content-line py-2.5 text-sm">
                        <dt className="shrink-0 font-medium text-content-subtle">
                            남은 골드 포스
                        </dt>
                        <dd className="font-semibold tabular-nums text-content-fg">
                            {goldforceDays === null
                                ? '없음'
                                : `${goldforceDays}일`}
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
                                const showPercent =
                                    skill.slot === 2 &&
                                    Number.isFinite(item.skillPercent) &&
                                    item.skillPercent > 0

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
                                            {skillLabelOf(skill)}
                                            {showPercent && (
                                                <span className="item-skill-percent whitespace-nowrap font-extrabold text-brand-highlight-deep">
                                                    ({item.skillPercent}%)
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
