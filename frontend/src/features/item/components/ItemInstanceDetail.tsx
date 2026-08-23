/**
 * ItemInstanceDetail — 보유 아이템 인스턴스 상세 (FC-077 — 목업 `itemDetail()` · design-brief B-11).
 *
 * 명칭·축 라벨·스킬 2슬롯·골드포스 잔여일은 상세 응답의 서버 `cardInfo`를 그대로 표시한다.
 *
 * ★ 목업 `item-detail-grid`(아트 + 스펙 카드) 레이아웃 1:1, 색만 장터 브랜드 토큰(§2.9).
 * ★ 아트는 공용 `ItemFrame`(72×134 캔버스 불변, §6.1) — 골드포스/스킬 마크 파생 포함.
 * ★ `slotNo` 는 **소유자 & INVENTORY 일 때만** 서버가 싣는다 → 있을 때만 슬롯·"경매에 등록"을
 *   낸다(그 조건이 곧 출품 가능 조건이라, 없을 때 등록 버튼을 감춰 헛클릭/404 를 막는다).
 * ★ 명칭·스킬·골드포스 잔여는 서버 `cardInfo`를 그대로 표시한다.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { TbArrowLeft, TbTag } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { itemArt } from '@/features/item/lib/itemArt'
import { itemLocationLabel } from '@/features/item/lib/itemLocation'
import ItemFrame from './ItemFrame'
import type { ItemInstanceDetail as ItemInstanceDetailData } from '@/lib/api/items'

interface ItemInstanceDetailProps {
    item: ItemInstanceDetailData
    /** 기존 상세 호출 계약과 테스트 시계 주입 형상을 유지한다. */
    now?: number
}

function SpecRow({
    term,
    children,
    termClassName = '',
}: {
    term: string
    children: ReactNode
    termClassName?: string
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-content-line py-3 last:border-b-0">
            <dt
                className={`text-sm font-medium text-content-subtle ${termClassName}`.trim()}
            >
                {term}
            </dt>
            <dd className="m-0 text-right text-sm font-semibold text-content-fg">
                {children}
            </dd>
        </div>
    )
}

function ItemInstanceDetail({ item }: ItemInstanceDetailProps) {
    const { template } = item
    const cardInfo = item.cardInfo
    if (!cardInfo) throw new Error('서버 카드정보 응답이 없습니다.')

    const art = itemArt(
        {
            subGroup: template.subGroup,
            kind: template.kind,
            element: template.element,
            level: item.level,
        },
        'l',
        1,
    )

    // 슬롯 번호를 먼저 매기고 null 을 거른다(마법 skill1 부재 → skill2 는 슬롯 2 유지, m-5).
    const skills = cardInfo.skills.filter((skill) => skill.code !== null)
    const hasSkill = skills.length > 0
    const skillRows = ([1, 2] as const).map((slot) => ({
        slot,
        skill: skills.find((skill) => skill.slot === slot),
    }))

    // 골드포스 잔여는 서버 cardInfo 스냅샷을 표시한다.
    const gfDays = cardInfo.frame.remainingGoldforceDays

    // slotNo 존재 = 소유자 & INVENTORY = 출품 가능 조건. 그때만 등록 버튼을 낸다.
    const canRegister = item.slotNo !== null && item.slotNo !== undefined

    return (
        <div className="flex flex-col gap-5">
            <Link
                to={paths.inventory}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-content-subtle hover:text-brand-structure"
            >
                <TbArrowLeft aria-hidden className="size-4" />
                인벤토리
            </Link>

            {/* 목업 item-detail-grid: 아트(고정폭) + 스펙 카드 */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                {/* 아트 — 네이비 그라데이션 스테이지(색만 브랜드) */}
                <section
                    className="grid min-h-[280px] place-items-center rounded-2xl bg-gradient-to-br from-chrome-selected to-chrome-strong p-6 lg:min-h-[430px]"
                    aria-label="아이템 이미지"
                >
                    <ItemFrame
                        imageUrl={art?.src}
                        spriteUrl={art?.src}
                        name={cardInfo.shortName}
                        frame={cardInfo.frame}
                        hasSkill={hasSkill}
                        size="stage"
                        scale={2}
                        className="w-full"
                    />
                </section>

                {/* 스펙 카드 */}
                <section className="detail-surface rounded-2xl border border-content-line bg-content-surface p-6">
                    {/* 배지: 위치 + (활성 시) 골드포스 */}
                    <div className="flex flex-wrap gap-2">
                        <span className="detail-meta rounded-md bg-brand-structure/5 px-2.5 py-1 text-xs font-semibold text-chrome-selected">
                            {itemLocationLabel(item.location)}
                        </span>
                        {cardInfo.frame.type === 'GOLD' && (
                            <span className="rounded-md bg-brand-highlight-soft px-2.5 py-1 text-xs font-semibold text-brand-highlight-deep">
                                골드포스 활성
                            </span>
                        )}
                    </div>

                    <h1 className="mt-3 text-2xl font-bold text-content-fg">
                        {cardInfo.formalName}
                    </h1>
                    <p className="mt-1 text-sm text-content-subtle">
                        {canRegister
                            ? `슬롯 ${item.slotNo}`
                            : '보유 아이템 정보'}
                    </p>

                    <dl className="mt-5">
                        <SpecRow term="종류">{cardInfo.kind.label}</SpecRow>
                        <SpecRow term="레벨">{item.level}</SpecRow>
                        <SpecRow term="속성">{cardInfo.element.label}</SpecRow>

                        {/* 스킬 — 슬롯 번호 유지, 이름 표시(없으면 중립 코드) */}
                        {skillRows.map(({ slot, skill }) => (
                            <SpecRow
                                key={slot}
                                term={`스킬 ${slot}`}
                                termClassName="item-skill-label"
                            >
                                <span
                                    className={
                                        skill
                                            ? 'item-skill-content'
                                            : 'text-content-subtle'
                                    }
                                >
                                    {skill?.name ?? '-'}
                                    {skill?.percent !== null &&
                                        skill?.percent !== undefined && (
                                            <span className="item-skill-percent">
                                                ({skill.percent}%)
                                            </span>
                                        )}
                                </span>
                            </SpecRow>
                        ))}

                        {cardInfo.frame.type === 'GOLD' && (
                            <SpecRow term="골드포스 잔여">
                                {gfDays}일 남음
                            </SpecRow>
                        )}

                        <SpecRow term="소유자">{item.ownerMasked}</SpecRow>
                    </dl>

                    {/* 액션 — 출품 가능(소유자 & INVENTORY)할 때만 등록 버튼 */}
                    {canRegister && (
                        <div className="mt-6 flex flex-wrap gap-2">
                            <Link
                                to={paths.sell}
                                className="detail-cta inline-flex items-center gap-1.5 rounded-lg bg-control-action px-4 py-2.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                            >
                                <TbTag aria-hidden className="size-4" />
                                경매에 등록
                            </Link>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}

export default ItemInstanceDetail
