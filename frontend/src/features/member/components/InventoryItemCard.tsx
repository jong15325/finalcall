import { memo } from 'react'
import ItemCard from '@/features/item/components/ItemCard'
import type { ItemCardData } from '@/features/item/components/ItemCard'
import { decodeTypeCode } from '@/features/item/lib/itemCode'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드 — **아이템 마켓 카드와 동일**(FC-178 · 승인 목업 `sell-flow-mockup.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **마켓 `ShopCard` 패턴을 그대로 이식**한다 — 공용 `ItemCard`(skillFlip)를 렌더하고
 *   카드 전체를 덮는 오버레이 버튼(`absolute inset-0`)으로 카드정보 모달을 연다. 마켓과 다른 점은
 *   **가격·판매자·비교 토글이 없다**는 것뿐이다(내 보유 아이템이라 판매가 없음 → `hidePrice`,
 *   `price`·`sellerNickname` 미전달, `CardCompareOverlay` 미부착).
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **flip-on-hover 는 `.shop-card` 스코프 CSS 로 동작**(ItemFrame.css `.shop-card:hover`)한다 —
 *   오버레이 버튼이 스킬 플립 영역을 덮으므로, 마켓처럼 루트에 `.shop-card` 클래스를 얹어야 카드
 *   어디를 hover 해도 뒷면(스킬)이 열린다. 그래서 마켓과 같은 래퍼 클래스를 재사용한다.
 * ★ **데이터 매핑**: 인벤토리 요약(`summary`)은 4축을 `typeCode` 하나로 싣는다(계약 §4.2) →
 *   `decodeTypeCode` 로 분해해 `ItemCardData` 로 옮긴다. 스킬명은 요약에 없어(skill1Name/skill2Name
 *   생략) `ItemSkillSummary` 가 코드→중립 표기(`스킬 #코드`)로 폴백한다(마켓 상세와 달리 이름 없음).
 * ★ 마켓 `ShopCard` 는 건드리지 않는다 — 회귀 방지를 위해 별도 컴포넌트로 둔다.
 */

interface InventoryItemCardProps {
    item: InventoryItem
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 카드 클릭 → 카드정보 모달 열기(부모가 안정 참조로 주입). */
    onOpen: (item: InventoryItem) => void
}

/** 인벤토리 요약 → 공용 카드 데이터(`ItemCardData`). 스킬명은 요약에 없어 넘기지 않는다. */
function toCardData(item: InventoryItem): ItemCardData {
    const { summary } = item
    const axes = decodeTypeCode(summary.typeCode)
    return {
        subGroup: axes.subGroup,
        kind: axes.kind,
        element: axes.element,
        level: summary.level,
        skill1: summary.skill1Code,
        skill2: summary.skill2Code,
        skillPercent: summary.skillPercent,
        goldforceExpireAt: summary.goldforceExpireAt,
        nameSnapshot: summary.displayName,
    }
}

function InventoryItemCard({ item, now, onOpen }: InventoryItemCardProps) {
    return (
        <div className="shop-card group relative h-full rounded-xl transition-transform hover:-translate-y-[3px]">
            <ItemCard
                skillFlip
                hidePrice
                item={toCardData(item)}
                now={now}
                className="h-full"
            />
            {/* 카드 영역 전체 열기 버튼 — 이미지·정보영역을 통째로 덮는다(마켓 ShopCard 이식). */}
            <button
                type="button"
                aria-label={`${item.summary.displayName} 카드정보 보기`}
                className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
                onClick={() => onOpen(item)}
            />
        </div>
    )
}

export default memo(InventoryItemCard)
