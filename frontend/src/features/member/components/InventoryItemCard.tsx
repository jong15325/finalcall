import { memo } from 'react'
import ItemCardTile from '@/features/item/components/ItemCardTile'
import type { ItemCardData } from '@/features/item/components/ItemCard'
import { decodeTypeCode } from '@/features/item/lib/itemCode'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드 — **아이템 마켓 카드와 동일**(FC-178 · 승인 목업 `sell-flow-mockup.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **정본 `ItemCardTile` 의 얇은 어댑터**(EPIC-CARD-SYSTEM T5 · 제안 §3 단계3). 마켓 `ShopCard`
 *   와 같은 타일 조립(`.shop-card` 래퍼·전면 오버레이 열기 버튼)을 공유하고, 이 어댑터는 인벤토리
 *   요약을 `ItemCardData` 로 매핑만 한다. 마켓과 다른 점은 **가격·판매자·비교 토글이 없다**는 것뿐
 *   (내 보유 아이템이라 판매가 없음 → `hidePrice`, `price`·`sellerNickname`·`compare` 미전달).
 *   그리드 슬롯 높이를 채우려 `fullHeight` 를 준다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **데이터 매핑**: 인벤토리 요약(`summary`)은 4축을 `typeCode` 하나로 싣는다(계약 §4.2) →
 *   `decodeTypeCode` 로 분해해 `ItemCardData` 로 옮긴다. 스킬명은 요약에 없어(skill1Name/skill2Name
 *   생략) `ItemSkillSummary` 가 코드→중립 표기(`스킬 #코드`)로 폴백한다(마켓 상세와 달리 이름 없음).
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
        <ItemCardTile
            skillFlip
            hidePrice
            fullHeight
            item={toCardData(item)}
            now={now}
            openLabel={item.summary.displayName}
            onOpen={() => onOpen(item)}
        />
    )
}

export default memo(InventoryItemCard)
