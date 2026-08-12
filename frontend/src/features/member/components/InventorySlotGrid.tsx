import { Fragment } from 'react'
import InventoryItemCard from './InventoryItemCard'
import type { DeliveryLookup } from '@/lib/queries/deliveries'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 슬롯 그리드 (FC-076 → FC-177 개편 → FC-178 마켓 카드 이식).
 *
 * ★ **FC-177 개편**: 좁은 820px 박스·타이틀바·카테고리·확장 자리·페이지 탭을 걷어내고,
 *   **아이템 마켓(`MarketPage`)과 같은 전체폭 그리드**로 바꾼다(2/3/6열 — 마켓과 동일 반응형).
 *   헤더·용량 배지·"임시 보관함" 액션은 페이지 셸(`InventoryPage`)이 담당하고, 이 컴포넌트는
 *   **슬롯 그리드만** 그린다(순수 표시 + 클릭 콜백).
 * ★ **FC-178**: 채운 슬롯을 **마켓 카드(`InventoryItemCard`)** 로 바꾼다 — 프레임만 있던 타일을
 *   마켓과 동일한 `ItemCard`(variant="market"·가격/판매자 없음) 카드로 교체하고, 클릭 시 카드정보 모달을
 *   연다. 빈 슬롯은 카드 높이에 맞춰 늘어난다(그리드 stretch + `h-full`, 마켓 카드가 더 큼).
 * ★ **capacity·used 는 서버값이 정본**(계약 §4.2) — 클라가 파생하지 않는다. 슬롯 1..capacity 를
 *   `slotNo` 로 채우고 나머지는 빈 슬롯으로 둔다. 페이지네이션은 두지 않는다(승인 목업 = 단일 그리드).
 * ★ **채운 슬롯 클릭 → 카드정보 모달**(부모가 `onItemClick` 으로 받는다). 스킬 플립은 마켓 카드가
 *   hover 로 그대로 제공한다.
 */

interface InventorySlotGridProps {
    capacity: number
    used: number
    items: InventoryItem[]
    /** 채운 슬롯 클릭 콜백(상세 다이얼로그 열기). */
    onItemClick: (item: InventoryItem) => void
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
    /** 배송 교차 조회 맵(FC-190, 계약 §4.6). 카드가 `itemInstancePublicId` 로 배송 상태를 얹는다. */
    deliveries?: DeliveryLookup
}

function InventorySlotGrid({
    capacity,
    used,
    items,
    onItemClick,
    now,
    deliveries,
}: InventorySlotGridProps) {
    // slotNo → 아이템 (1-based 배치). 같은 슬롯 중복은 나중 값이 이긴다(정상 데이터엔 없음).
    const bySlot = new Map<number, InventoryItem>()
    for (const item of items) bySlot.set(item.slotNo, item)

    const slotCount = Math.max(capacity, used)
    const slotNumbers: number[] = []
    for (let slot = 1; slot <= slotCount; slot += 1) slotNumbers.push(slot)

    return (
        <Fragment>
            {slotNumbers.map((slotNo) => {
                const item = bySlot.get(slotNo)
                return (
                    <li key={slotNo} className="flex">
                        {item ? (
                            <InventoryItemCard
                                item={item}
                                now={now}
                                deliveryStatus={
                                    deliveries?.get(item.itemInstancePublicId)
                                        ?.status
                                }
                                onOpen={onItemClick}
                            />
                        ) : (
                            <EmptySlot slotNo={slotNo} />
                        )}
                    </li>
                )
            })}
        </Fragment>
    )
}

/**
 * 빈 슬롯 — 번호만. 상호작용 없음.
 *
 * ★ 마켓 카드가 프레임 타일보다 크므로 고정 높이를 두지 않고 **행 높이에 맞춰 늘어난다**
 *   (`h-full`, 그리드 stretch). 채운 카드가 없는 후행 행에선 `min-h` 가 바닥을 잡는다(목업 정합).
 */
function EmptySlot({ slotNo }: { slotNo: number }) {
    return (
        <div
            aria-label={`빈 슬롯 ${slotNo}`}
            className="relative flex h-full min-h-[210px] w-full items-center justify-center rounded-xl border border-dashed border-content-line bg-content-soft"
        >
            <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-lg bg-content-soft text-2xl font-light text-content-line"
            >
                +
            </span>
            <span
                aria-hidden
                className="absolute bottom-2 right-2.5 text-[10px] font-bold text-content-line"
            >
                {String(slotNo).padStart(2, '0')}
            </span>
        </div>
    )
}

export default InventorySlotGrid
