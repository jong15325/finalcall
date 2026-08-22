import { memo } from 'react'
import { TbLock } from 'react-icons/tb'
import ItemCardActionSurface from '@/features/item/components/ItemCardActionSurface'
import ItemCardView, { ItemCardArtwork } from '@/features/item/components/ItemCardView'
import { toItemCardViewModel } from '@/features/item/components/itemCardModel'
import type { ItemCardSource } from '@/features/item/components/itemCardModel'
import { decodeTypeCode } from '@/features/item/lib/itemCode'
import DeliveryBadge from '@/features/delivery/components/DeliveryBadge'
import { isFailed, isShipping } from '@/features/delivery/lib/deliveryView'
import type { DeliveryStatus } from '@/lib/api/deliveries'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 카드 — **아이템 마켓 카드와 동일**(FC-178 · 승인 목업 `sell-flow-mockup.html`).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **정본 카드 composition의 얇은 어댑터**. 마켓 `ShopCard`
 *   와 같은 타일 조립(`.shop-card` 래퍼·전면 오버레이 열기 버튼)을 공유하고, 이 어댑터는 인벤토리
 *   요약을 view model로 매핑만 한다. 마켓과 다른 점은 **가격·판매자·비교 토글이 없다**는 것뿐
 *   (내 보유 아이템이라 판매가 없음 → `price`·`sellerNickname`·`compare` 미전달, `variant="market"`).
 *   그리드 슬롯 높이를 채우려 `fullHeight` 를 준다.
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **데이터 매핑**: 인벤토리 요약(`summary`)은 4축을 `typeCode` 하나로 싣는다(계약 §4.2) →
 *   `decodeTypeCode` 로 분해해 공용 source로 옮긴다. **스킬명(skill1Name/skill2Name)은 계약
 *   v1.21(FC-179) 델타로 요약에 실린다** → 그대로 전달해 인벤 카드도 `스킬 #코드` 대신 실제 이름을
 *   표시한다(마켓·경매와 동일 배선 = `skillSlots.skillLabelOf`). 이름이 null 이면 코드 폴백은 유지.
 *
 * ★ **배송 상태(FC-190)**: 상위가 `itemInstancePublicId` 교차 조회로 `deliveryStatus` 를 주입한다
 *   (계약 §4.6, 형상 보존 — 인벤 응답엔 배송 정보가 없다). 배송중이면 좌상단 배송 배지 + 하단
 *   "배송 중 · 판매 등록 불가" 잠금 문구(디자인 승인 "상시 노출"). FAILED 는 문의 안내. APPLIED
 *   아이템은 IN_GAME 으로 빠져 인벤에 오지 않으므로 여기선 다루지 않는다(도착 배너·거래내역 담당).
 */

interface InventoryItemCardProps {
    item: InventoryItem
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 카드 클릭 → 카드정보 모달 열기(부모가 안정 참조로 주입). */
    onOpen: (item: InventoryItem) => void
    /** 교차 조회한 배송 상태(계약 §4.6). 부재면 배지·잠금 없음(배송 없는 일반 보유 아이템). */
    deliveryStatus?: DeliveryStatus
}

/** 인벤토리 요약 → 공용 카드 source. 스킬명(v1.21 델타)을 그대로 전달한다. */
function toCardData(item: InventoryItem): ItemCardSource {
    const { summary } = item
    const axes = decodeTypeCode(summary.typeCode)
    return {
        subGroup: axes.subGroup,
        kind: axes.kind,
        element: axes.element,
        level: summary.level,
        skill1: summary.skill1Code,
        skill2: summary.skill2Code,
        skill1Name: summary.skill1Name,
        skill2Name: summary.skill2Name,
        skillPercent: summary.skillPercent,
        goldforceExpireAt: summary.goldforceExpireAt,
        nameSnapshot: summary.displayName,
    }
}

function InventoryItemCard({
    item,
    now,
    onOpen,
    deliveryStatus,
}: InventoryItemCardProps) {
    const shipping = deliveryStatus !== undefined && isShipping(deliveryStatus)
    const failed = deliveryStatus !== undefined && isFailed(deliveryStatus)

    const badge =
        deliveryStatus !== undefined ? (
            <DeliveryBadge status={deliveryStatus} size="sm" />
        ) : undefined

    // 배송 진행 중·실패는 하단에 상시 잠금 문구(디자인 승인 "상시 노출"). 재판매(판매 등록) 불가.
    const footer = shipping ? (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-content-subtle">
            <TbLock aria-hidden className="size-3.5" />
            배송 중 · 판매 등록 불가
        </span>
    ) : failed ? (
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-danger-ink">
            <TbLock aria-hidden className="size-3.5" />
            지급 실패 · 고객센터 문의
        </span>
    ) : undefined
    const viewModel = toItemCardViewModel(toCardData(item), now ?? Date.now())
    const action = {
        kind: 'button' as const,
        label: `${viewModel.name} 카드정보 보기`,
        onPress: () => onOpen(item),
    }
    const artworkAction = (
        <ItemCardActionSurface area="artwork" keyboard={false} action={action} />
    )
    const controlGapAction = (
        <ItemCardActionSurface
            area="control-gap"
            keyboard={false}
            action={action}
        />
    )

    return (
        <div className="shop-card group relative h-full w-full rounded-xl transition-transform hover:-translate-y-[3px]">
            <ItemCardView
                fullHeight
                density="compact"
                item={viewModel}
                artwork={
                    <div className="item-card__artwork-composition">
                        <div className="item-card__skill-flip is-market">
                            <ItemCardArtwork item={viewModel} />
                        </div>
                        <div className="item-card__artwork-controls">
                            <div className="item-card__control-gap">
                                {controlGapAction}
                            </div>
                        </div>
                        {badge ? (
                            <div
                                className="item-card__leading-status"
                                data-card-overlay="badge"
                            >
                                {badge}
                            </div>
                        ) : null}
                        {artworkAction}
                    </div>
                }
                action={
                    <ItemCardActionSurface
                        opensDialog
                        action={action}
                    />
                }
                footer={footer}
                footerAction={
                    footer ? (
                        <ItemCardActionSurface
                            area="footer"
                            keyboard={false}
                            action={action}
                        />
                    ) : undefined
                }
            />
        </div>
    )
}

export default memo(InventoryItemCard)
