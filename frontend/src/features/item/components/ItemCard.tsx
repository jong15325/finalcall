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
 */
import type { ReactNode } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import { itemArt } from '@/features/item/lib/itemArt'
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
    goldforceExpireAt?: string | null
    /** 등록 시점 스냅샷(D-045) — 표시 정본 */
    nameSnapshot: string
    specSnapshot?: string
}

interface ItemCardProps {
    item: ItemCardData
    /** 표시 가격(원본 정수). 예: `highestBidAmount ?? startPrice`(대체는 호출부 결정). 없으면 "-" */
    price?: number | null
    /** 가격 앞 라벨(예: "현재가"·"시작가"). 생략 가능 */
    priceLabel?: string
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now() */
    now?: number
    /** 프레임 위 오버레이(CompareToggle 등) — 이미지 크기 불변 */
    overlay?: ReactNode
    /** 카드 외부 액션 행(구매 버튼 등) */
    footer?: ReactNode
    className?: string
}

function ItemCard({
    item,
    price,
    priceLabel,
    now,
    overlay,
    footer,
    className = '',
}: ItemCardProps) {
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
        <article
            className={`item-card flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md ${className}`.trim()}
        >
            <ItemFrame
                imageUrl={art?.src}
                artWidth={art?.width}
                artHeight={art?.height}
                spriteUrl={art?.src}
                name={item.nameSnapshot}
                visual={{ goldforceExpireAt: item.goldforceExpireAt }}
                hasSkill={hasSkill}
                now={now}
                overlay={overlay}
            />

            <div className="flex flex-1 flex-col gap-1.5 p-3">
                <h3 className="line-clamp-2 min-h-[2.6em] text-[13px] font-bold leading-tight text-gray-900 xs:text-sm">
                    {item.nameSnapshot}
                </h3>

                <p className="truncate text-[11px] text-gray-500 xs:text-xs">
                    {item.specSnapshot || ' '}
                </p>

                <div className="mt-auto flex items-baseline gap-1.5 whitespace-nowrap pt-1">
                    {priceLabel && (
                        <span className="text-[11px] text-gray-400 xs:text-xs">
                            {priceLabel}
                        </span>
                    )}
                    <CodeAmount
                        value={price}
                        mode="compact"
                        className="text-[13px] font-bold text-gray-900 xs:text-sm"
                    />
                </div>

                <ItemSkillSummary
                    skill1={item.skill1}
                    skill2={item.skill2}
                    className="pt-0.5"
                />
            </div>

            {footer ? (
                <div className="border-t border-line p-2">{footer}</div>
            ) : null}
        </article>
    )
}

export default ItemCard
