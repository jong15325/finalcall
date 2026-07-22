import ItemFrame from '@/features/item/components/ItemFrame'
import { goldforceRemainingDays } from '@/features/item/components/frame'
import {
    resolveSkillSlots,
    skillLabelOf,
} from '@/features/item/components/skillSlots'
import { elementBadgeLabelOf } from '@/features/item/lib/element'
import { itemArt } from '@/features/item/lib/itemArt'
import { itemTypeLabel } from '@/features/item/lib/itemCode'
import {
    auctionPhaseLabelOf,
    type AuctionPhase,
} from '@/features/auction/lib/auctionPhase'
import type { AuctionDetail } from '@/lib/api/auctions'

/**
 * 경매 상세 히어로 카드 (FC-072 — 목업 `.auction-hero-card` 1:1 · design-brief B-3).
 *
 * 목업 구조: `245px 아트 | 1fr copy` 그리드(모바일 118px). 좌측 어두운 스테이지 + 공용 `ItemFrame`,
 * 우측 copy(상태배지·골드포스배지·이름·타입줄·`.spec-box`·`.skill-list`).
 *
 * ★ **스킬명은 item 블록의 skill1Name/skill2Name 으로 표시**(계약 §3.3 델타 — EPIC-MARKET-DATA).
 *   이름이 없으면 `스킬 #{code}` 중립 표기로 폴백한다. 슬롯 번호는 `resolveSkillSlots` 가 먼저
 *   매기고 걸러 마법(subGroup 3, skill1 부재)이 "스킬 1" 로 오표기되지 않는다(FC-064 함정 4).
 *   발동확률은 상세 dl 의 **전용 "발동 확률" 행**으로 낸다(승인된 목업 1:1 레이아웃 유지).
 * ★ **골드포스 잔여일은 클라 파생**(서버는 만료 시각만) — 활성일 때만 배지. 색은 브랜드 골드 토큰.
 * ★ 색은 브랜드 팔레트(navy/gold) — 목업 Vuexy 잔재색은 쓰지 않는다(§2.9).
 */

const PHASE_BADGE_CLASS: Record<AuctionPhase, string> = {
    live: 'bg-success-subtle text-success',
    scheduled: 'bg-navy/10 text-navy-700',
    ended: 'bg-gray-100 text-gray-500',
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

    return (
        <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[118px_minmax(0,1fr)] lg:grid-cols-[245px_minmax(0,1fr)]">
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
                    {goldforceDays !== null && (
                        <span className="rounded-full bg-gold-subtle px-2.5 py-1 text-[11px] font-bold text-gold-deep">
                            골드포스 {goldforceDays}일 남음
                        </span>
                    )}
                </div>

                <h2 className="mt-4 text-xl font-bold leading-tight text-gray-900 lg:text-2xl">
                    {item.nameSnapshot}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                    {itemTypeLabel(item.subGroup, item.kind)} ·{' '}
                    {elementBadgeLabelOf(item.element)} · Lv.{item.level}
                </p>

                <p className="my-5 rounded-lg bg-surface-sunken p-3.5 text-sm text-gray-600">
                    {item.specSnapshot}
                </p>

                <dl className="mt-auto">
                    {skills.map((skill) => (
                        <div
                            key={skill.slot}
                            className="flex items-center justify-between border-b border-line py-2.5 text-sm"
                        >
                            <dt className="font-medium text-gray-500">
                                스킬 {skill.slot}
                            </dt>
                            <dd className="font-semibold text-gray-900">
                                {skillLabelOf(skill)}
                            </dd>
                        </div>
                    ))}
                    {item.skillPercent > 0 && (
                        <div className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                            <dt className="font-medium text-gray-500">
                                발동 확률
                            </dt>
                            <dd className="font-semibold text-gray-900">
                                +{item.skillPercent}%
                            </dd>
                        </div>
                    )}
                    {skills.length === 0 && item.skillPercent <= 0 && (
                        <div className="py-2.5 text-sm text-gray-400">
                            스킬 없음
                        </div>
                    )}
                </dl>
            </div>
        </section>
    )
}

export default AuctionHeroCard
