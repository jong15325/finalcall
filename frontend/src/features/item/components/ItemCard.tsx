/**
 * ItemCard — 탐색용 아이템 카드 (FC-068).
 *
 * ItemFrame + 이름(최대 2줄)·부가설명(1줄 말줄임)·가격(CodeAmount)·스킬요약을 합친다.
 * 아트 경로는 보존 `itemArt` lib 로 파생한다(범위 밖/미등록은 null → ItemFrame 플레이스홀더).
 *
 * ★ **링크를 만들지 않는다.** 경매 item 블록엔 인스턴스 ID 가 없어(§2.1) 카드→상세 링크가
 *   불가하고, 링크 대상은 맥락마다 다르다(경매=auctionPublicId·인벤토리=인스턴스 ID). 라우팅은
 *   화면 티켓(FC-070+)이 카드를 감싸 소유한다 — 이 컴포넌트는 표시만 한다.
 * ★ 카드텍스트 토큰(§3.2): PC 이름14/설명12/가격14, 모바일 13/11/13. 기본(모바일) 크기에
 *   `xs:`(≥576px) 로 PC 크기를 얹는다.
 * ★ 구매/비교는 **오버레이(`overlay`)나 카드 외부 액션(`footer`)** 으로 받는다 — 이미지 크기 불변.
 * ★ 가격은 **줄바꿈 금지**(CodeAmount + whitespace-nowrap). 값 없음(입찰 0건)은 CodeAmount 가 "-".
 *
 * ★ **variant 모델**(EPIC-CARD-SYSTEM T6 · 제안 §2.3 — boolean 폭발 제거). 맥락 차이는
 *   boolean 가법(구 `skillFlip`·`hidePrice`)이 아니라 `variant` + nullable `price` + slot 으로 흡수한다:
 *   - `variant`: `'browse'`(세로 스택·비플립·기본) · `'market'`(마켓 정보영역 + 스킬 플립).
 *   - `price`: 부재(undefined·null)면 **가격 줄을 그리지 않는다**(구 `hidePrice=true`). `{ amount: null }`
 *     이면 줄은 그리되 CodeAmount 가 "-"(입찰 0건). `label` 은 browse 레이아웃에서만 앞에 붙는다.
 */
import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import { itemArt } from '@/features/item/lib/itemArt'
import { elementLabelOf } from '@/features/item/lib/element'
import { kindLabelOf, subGroupLabelOf } from '@/features/item/lib/itemCode'
import { resolveFrameType } from './frame'
import ItemFrame from './ItemFrame'
import ItemSkillSummary from './ItemSkillSummary'

/**
 * 카드가 필요로 하는 item 필드(계약 공통 item 블록의 구조적 부분집합).
 * `AuctionItemBlock` 을 그대로 넘길 수 있다.
 */
export interface ItemCardData {
    subGroup: number
    kind: number
    element: number
    level: number
    skill1: number | null
    skill2: number | null
    /** 스킬명(계약 §3.3 델타). 없으면 중립 표기 폴백 — `AuctionItemBlock` 이 그대로 만족한다 */
    skill1Name?: string | null
    skill2Name?: string | null
    /** 스킬2 줄 발동확률(%). 0·부재면 요약에서 생략 */
    skillPercent?: number | null
    goldforceExpireAt?: string | null
    /** 등록 시점 스냅샷(D-045) — 표시 정본 */
    nameSnapshot: string
    specSnapshot?: string
}

/** 카드 레이아웃·타이포·스킬플립 프리셋(제안 §2.3). */
export type ItemCardVariant = 'browse' | 'market'

/** 카드 가격 표시(제안 §2.3). 부재면 가격 줄 없음, `amount:null` 이면 "-". */
export interface ItemCardPrice {
    /** 표시 금액(원본 정수). `null` 이면 CodeAmount 가 "-"(입찰 0건 등) */
    amount: number | null
    /** 금액 앞 라벨(예: "현재가"·"등록가"). browse 레이아웃에서만 표시 */
    label?: string
}

interface ItemCardProps {
    item: ItemCardData
    /** 레이아웃·타이포·스킬플립 프리셋(제안 §2.3). 기본 `'browse'`(비플립 세로 스택). */
    variant?: ItemCardVariant
    /**
     * 표시 가격. **부재(undefined·null)면 가격 줄을 그리지 않는다**(구 `hidePrice`). `{ amount: null }`
     * 이면 줄은 그리되 "-"(입찰 0건). 대체(`highestBidAmount ?? startPrice`)는 호출부가 결정.
     */
    price?: ItemCardPrice | null
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now() */
    now?: number
    /** 프레임 위 오버레이(CompareToggle 등) — 이미지 크기 불변 */
    overlay?: ReactNode
    /** 마켓 카드 뒷면 판매자(market 전용). */
    sellerNickname?: string
    /** 카드 외부 액션 행(구매 버튼 등) */
    footer?: ReactNode
    /**
     * 정보영역(이미지 아래)을 덮는 상세 링크 오버레이(market 전용).
     * 정보 컨테이너 안에 렌더돼 레이아웃으로 크기가 잡히므로 이미지 플립 영역을 덮지 않는다(M2).
     * 라우팅은 호출부(ShopCard 등)가 소유한다 — ItemCard 는 링크를 만들지 않는다(§ 상단).
     */
    detailLink?: ReactNode
    className?: string
}

function ItemCard({
    item,
    variant = 'browse',
    price,
    now,
    overlay,
    sellerNickname,
    footer,
    detailLink,
    className = '',
}: ItemCardProps) {
    // market 은 마켓 정보영역 + 스킬 플립 프리셋(browse 는 비플립 세로 스택).
    const isMarket = variant === 'market'
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
    const flipEnabled = isMarket && hasSkill
    const referenceNow = now ?? Date.now()
    const frameLabel =
        resolveFrameType(
            { goldforceExpireAt: item.goldforceExpireAt },
            referenceNow,
        ) === 'GOLDFORCE'
            ? '골드'
            : '블랙'
    const groupLabel = subGroupLabelOf(item.subGroup)
    const kindLabel = kindLabelOf(item.subGroup, item.kind)
    const marketTitle = `${frameLabel} - ${groupLabel}`
    const [flipped, setFlipped] = useState(false)
    const skillsId = useId()

    useEffect(() => {
        if (!flipped) return
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setFlipped(false)
        }
        window.addEventListener('keydown', closeOnEscape)
        return () => window.removeEventListener('keydown', closeOnEscape)
    }, [flipped])

    return (
        <article
            className={`item-card flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md ${className}`.trim()}
        >
            <div
                className={`item-card__skill-flip ${isMarket ? 'is-market' : ''} ${flipEnabled ? 'is-enabled' : ''}`.trim()}
                data-flipped={flipped}
            >
                <div className="item-card__skill-flip-inner">
                    <div
                        aria-hidden={flipped}
                        className="item-card__skill-flip-face item-card__skill-flip-front"
                        inert={flipped}
                    >
                        <ItemFrame
                            showGoldforceDays
                            imageUrl={art?.src}
                            spriteUrl={art?.src}
                            name={item.nameSnapshot}
                            visual={{
                                goldforceExpireAt: item.goldforceExpireAt,
                            }}
                            hasSkill={hasSkill}
                            now={now}
                            overlay={flipEnabled ? undefined : overlay}
                        />
                    </div>

                    {flipEnabled && (
                        <div
                            id={skillsId}
                            aria-hidden={!flipped}
                            className="item-card__skill-flip-face item-card__skill-flip-back"
                            inert={!flipped}
                        >
                            <strong>{marketTitle}</strong>
                            <span className="item-card__skill-name">
                                {kindLabel} · Lv.{item.level}
                            </span>
                            <ItemSkillSummary
                                showSlotLabels
                                skill1={item.skill1}
                                skill2={item.skill2}
                                skill1Name={item.skill1Name}
                                skill2Name={item.skill2Name}
                                skillPercent={item.skillPercent}
                                className="item-card__skill-list"
                            />
                            {sellerNickname && (
                                <small>
                                    판매자 <b>{sellerNickname}</b>
                                </small>
                            )}
                        </div>
                    )}
                </div>

                {flipEnabled && overlay && (
                    <div className="item-frame__overlay">{overlay}</div>
                )}

                {flipEnabled && (
                    <button
                        type="button"
                        className="item-card__skill-flip-trigger"
                        aria-label={`${item.nameSnapshot} 스킬 ${flipped ? '닫기' : '보기'}`}
                        aria-expanded={flipped}
                        aria-controls={skillsId}
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setFlipped((value) => !value)
                        }}
                    />
                )}
            </div>

            {isMarket ? (
                <div className="item-card__market-info flex flex-1 flex-col p-3">
                    <div className="item-card__market-heading">
                        <h3>{marketTitle}</h3>
                        <span
                            className={`item-card__element-badge element-${item.element}`}
                        >
                            {elementLabelOf(item.element)}
                        </span>
                    </div>
                    <p>
                        {kindLabel} · Lv.{item.level}
                    </p>
                    <ItemSkillSummary
                        showSlotLabels
                        skill1={item.skill1}
                        skill2={item.skill2}
                        skill1Name={item.skill1Name}
                        skill2Name={item.skill2Name}
                        skillPercent={item.skillPercent}
                        className="item-card__market-skills"
                    />
                    {price && (
                        <div className="item-card__market-price">
                            <CodeAmount value={price.amount} mode="compact" />
                        </div>
                    )}
                    {detailLink}
                </div>
            ) : (
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-bold leading-tight text-gray-900 xs:text-sm">
                        {item.nameSnapshot}
                    </h3>
                    <p className="truncate text-[11px] text-gray-500 xs:text-xs">
                        {item.specSnapshot || ' '}
                    </p>
                    {price && (
                        <div className="mt-auto flex items-baseline gap-1.5 whitespace-nowrap pt-1">
                            {price.label && (
                                <span className="text-[11px] text-gray-400 xs:text-xs">
                                    {price.label}
                                </span>
                            )}
                            <CodeAmount
                                value={price.amount}
                                mode="compact"
                                className="text-[13px] font-bold text-gray-900 xs:text-sm"
                            />
                        </div>
                    )}
                    <ItemSkillSummary
                        skill1={item.skill1}
                        skill2={item.skill2}
                        skill1Name={item.skill1Name}
                        skill2Name={item.skill2Name}
                        skillPercent={item.skillPercent}
                        className="pt-0.5"
                    />
                </div>
            )}

            {footer ? (
                <div className="border-t border-line p-2">{footer}</div>
            ) : null}
        </article>
    )
}

export default ItemCard
