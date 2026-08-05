import type { ReactNode } from 'react'
import ItemCard from '@/features/item/components/ItemCard'
import type {
    ItemCardData,
    ItemCardPrice,
    ItemCardVariant,
} from '@/features/item/components/ItemCard'

/**
 * ItemCardTile — 카드 *상호작용 표면* 정본 (EPIC-CARD-SYSTEM T5 · 제안 §2.2·§3 단계3).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **"눌러서 카드정보 모달 여는 카드"라는 조립을 한 곳으로.** `ItemCard`(세로 본체)를
 *   `.shop-card` 래퍼 + 카드 전면 오버레이 버튼(`absolute inset-0 z-10` → onOpen) + 우상단 비교
 *   오버레이(z-20) + footer 로 감싼다. 마켓 `ShopCard`·인벤토리 `InventoryItemCard` 가 이 조립을
 *   ~15줄씩 복붙 포크했다(제안 §1.4(2) — member 가 shop 을 베낌). 타일은 그 공통 표면을 **정본으로
 *   소유**하고, 소비자는 도메인 요약→`ItemCardData` 매핑 + 슬롯 주입만 하는 얇은 어댑터로 축소된다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **flip-on-hover 는 `.shop-card` 스코프 CSS**(ItemFrame.css `.shop-card:hover`)로 동작한다 —
 *   전면 오버레이 버튼이 스킬 플립 영역을 덮으므로, 루트에 `.shop-card` 를 얹어야 카드 어디를
 *   hover 해도 뒷면(스킬)이 열린다. 오버레이 버튼은 `.shop-card` 의 자손이라 hover 가 유지된다.
 * ★ **중복 트리거 방지**: 열기 오버레이(z-10)와 비교 오버레이(z-20)는 형제 층이라 클릭이 서로
 *   버블링되지 않는다(비교 토글은 자체 `stopPropagation` 도 갖는다).
 * ★ **feature 결합은 슬롯으로**: 비교 오버레이·판매자 이름 등 맥락 값은 소비자가 슬롯/props 로
 *   주입한다 — 타일은 chrome 만 소유한다(제안 §2.4, FE rules §9.1).
 */

interface ItemCardTileProps {
    /** 세로 카드 본체가 그릴 아이템(도메인 요약을 어댑터가 매핑). */
    item: ItemCardData
    /** 전면 오버레이 버튼 클릭 — 카드정보 모달 열기(부모가 안정 참조로 주입). */
    onOpen: () => void
    /** 열기 버튼 접근성 라벨 접두(아이템 표시명). `${openLabel} 카드정보 보기`. */
    openLabel: string
    /** 카드 레이아웃 프리셋(제안 §2.3). 기본 `'browse'` — 마켓/인벤은 `'market'`. */
    variant?: ItemCardVariant
    /** 표시 가격. 부재면 가격 줄 없음(인벤토리처럼 가격 없는 맥락은 미전달). */
    price?: ItemCardPrice | null
    /** 골드포스 파생 기준 시각(목록 마운트 시각 1회로 고정 주입). 기본 Date.now(). */
    now?: number
    /** 마켓 카드 뒷면 판매자(market 전용). */
    sellerNickname?: string
    /** 카드가 그리드 슬롯 높이를 채운다(인벤토리). 래퍼·본체에 `h-full`. */
    fullHeight?: boolean
    /** 우상단 비교 오버레이 슬롯(마켓 등). 없으면 미렌더. */
    compare?: ReactNode
    /** 좌상단 배지 오버레이 슬롯(배송 상태 등, FC-190). 없으면 미렌더. 열기 버튼(z-10) 위층(z-20). */
    badge?: ReactNode
    /** 카드 외부 액션 행(`ItemCard` footer 로 전달). */
    footer?: ReactNode
}

function ItemCardTile({
    item,
    onOpen,
    openLabel,
    variant = 'browse',
    price,
    now,
    sellerNickname,
    fullHeight = false,
    compare,
    badge,
    footer,
}: ItemCardTileProps) {
    return (
        <div
            className={`shop-card group relative ${fullHeight ? 'h-full ' : ''}rounded-xl transition-transform hover:-translate-y-[3px]`}
        >
            <ItemCard
                variant={variant}
                item={item}
                price={price}
                now={now}
                sellerNickname={sellerNickname}
                footer={footer}
                className={fullHeight ? 'h-full' : ''}
            />
            {/* 카드 영역 전체 열기 버튼 — 이미지·정보영역을 통째로 덮는다(비교 오버레이 z-20 은 위층). */}
            <button
                type="button"
                aria-label={`${openLabel} 카드정보 보기`}
                className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
                onClick={onOpen}
            />
            {compare && (
                <div className="absolute right-1.5 top-1.5 z-20">{compare}</div>
            )}
            {badge && (
                <div className="absolute left-1.5 top-1.5 z-20">{badge}</div>
            )}
        </div>
    )
}

export default ItemCardTile
