import type { CSSProperties } from 'react'
import ItemFrame from '@/features/item/components/ItemFrame'
import { deriveItemSummaryArt } from '@/features/item/lib/itemSummary'
import type { InventoryItem } from '@/lib/api/inventory'
import './InventorySlotGrid.css'

/**
 * 인벤토리 슬롯 그리드 (FC-076 → FC-177 개편 — 아이템 마켓과 동형 전체폭 영역).
 *
 * ★ **FC-177 개편**: 좁은 820px 박스·타이틀바·카테고리·확장 자리·페이지 탭을 걷어내고,
 *   **아이템 마켓(`MarketPage`)과 같은 전체폭 그리드**로 바꾼다(2/3/6열 — 마켓과 동일 반응형).
 *   헤더·용량 배지·"임시 보관함" 액션은 페이지 셸(`InventoryPage`)이 담당하고, 이 컴포넌트는
 *   **슬롯 그리드만** 그린다(순수 표시 + 클릭 콜백).
 * ★ **capacity·used 는 서버값이 정본**(계약 §4.2) — 클라가 파생하지 않는다. 슬롯 1..capacity 를
 *   `slotNo` 로 채우고 나머지는 빈 슬롯으로 둔다. 페이지네이션은 두지 않는다(승인 목업 = 단일 그리드).
 * ★ **인벤토리 성격 유지**: 프레임 타일(72×134 아트, 크로마키)·빈 슬롯(번호)·용량. 그리드 셀이
 *   넓어지므로 프레임은 **원본 비율 그대로 중앙 정렬**한다(아트 왜곡 금지 — 정수배만 확대 가능).
 * ★ **채운 슬롯 클릭 → 상세 다이얼로그**(부모가 `onItemClick` 으로 받는다). 예전 스킬 플립
 *   상호작용은 다이얼로그 상세로 흡수해 중복을 제거했다.
 */

interface InventorySlotGridProps {
    capacity: number
    used: number
    items: InventoryItem[]
    /** 채운 슬롯 클릭 콜백(상세 다이얼로그 열기). */
    onItemClick: (item: InventoryItem) => void
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
}

function InventorySlotGrid({
    capacity,
    used,
    items,
    onItemClick,
    now,
}: InventorySlotGridProps) {
    // slotNo → 아이템 (1-based 배치). 같은 슬롯 중복은 나중 값이 이긴다(정상 데이터엔 없음).
    const bySlot = new Map<number, InventoryItem>()
    for (const item of items) bySlot.set(item.slotNo, item)

    const slotCount = Math.max(capacity, used)
    const slotNumbers: number[] = []
    for (let slot = 1; slot <= slotCount; slot += 1) slotNumbers.push(slot)

    return (
        <ul
            aria-label="인벤토리 슬롯"
            className="grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6"
        >
            {slotNumbers.map((slotNo) => {
                const item = bySlot.get(slotNo)
                return (
                    <li key={slotNo}>
                        {item ? (
                            <FilledSlot
                                item={item}
                                now={now}
                                onClick={onItemClick}
                            />
                        ) : (
                            <EmptySlot slotNo={slotNo} />
                        )}
                    </li>
                )
            })}
        </ul>
    )
}

/**
 * 채운 슬롯 — 72×134 프레임을 공용 스프라이트 스테이지(다크 아웃라인) 박스에 담는다.
 *
 * ★ 셀이 마켓 카드처럼 넓어져도 프레임(72×134)은 **원본 크기로 중앙 정렬**된다(다크 스테이지가
 *   셀 폭을 메운다) — 아트 비율·크로마키는 불변. hover 확대(zoom)는 `.inv-slot` 스코프 CSS.
 * ★ 이름은 링크 텍스트 없이 `aria-label` 로만 접근성 노출한다(이미지 중심, FC-102 계승).
 * ★ 슬롯 전체가 상세 다이얼로그를 여는 버튼이다(클릭 → `onClick(item)`).
 */
function FilledSlot({
    item,
    now,
    onClick,
}: {
    item: InventoryItem
    now?: number
    onClick: (item: InventoryItem) => void
}) {
    const { art, hasSkill } = deriveItemSummaryArt(item.summary)
    const name = item.summary.displayName

    return (
        <button
            type="button"
            aria-label={`${name} Lv.${item.summary.level} 상세 보기`}
            className="inv-slot item-sprite-stage flex h-[168px] w-full items-center justify-center rounded-xl border border-line p-0 transition-[border-color,box-shadow] hover:border-navy hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
            style={
                art?.src
                    ? ({
                          '--item-sprite': `url("${art.src}")`,
                      } as CSSProperties)
                    : undefined
            }
            onClick={() => onClick(item)}
        >
            <ItemFrame
                imageUrl={art?.src}
                spriteUrl={art?.src}
                name={name}
                visual={{
                    goldforceExpireAt: item.summary.goldforceExpireAt,
                }}
                hasSkill={hasSkill}
                size="frame"
                now={now}
            />
        </button>
    )
}

/** 빈 슬롯 — 번호만. 상호작용 없음. 채운 슬롯과 같은 높이(h-[168px]). */
function EmptySlot({ slotNo }: { slotNo: number }) {
    return (
        <div
            aria-label={`빈 슬롯 ${slotNo}`}
            className="relative flex h-[168px] w-full items-center justify-center rounded-xl border border-dashed border-line bg-surface-sunken"
        >
            <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-lg bg-gray-100 text-2xl font-light text-gray-300"
            >
                +
            </span>
            <span
                aria-hidden
                className="absolute bottom-2 right-2.5 text-[10px] font-bold text-gray-300"
            >
                {String(slotNo).padStart(2, '0')}
            </span>
        </div>
    )
}

export default InventorySlotGrid
