import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { TbArchive, TbLayoutGrid, TbLock } from 'react-icons/tb'
import { itemDetailPath, paths } from '@/app/paths'
import ItemFrame from '@/features/item/components/ItemFrame'
import { deriveItemSummaryArt } from '@/features/item/lib/itemSummary'
import type { InventoryItem } from '@/lib/api/inventory'

/**
 * 인벤토리 슬롯 그리드 (FC-076 — 목업 `.mycard-window`/`.mycard-grid`/`.mycard-tabs` · design-brief B-9).
 *
 * ★ **구조 = 목업 그대로, 색 = 브랜드 토큰**(§2.9). 목업의 Vuexy 퍼플(`#7367f0`)은 템플릿 잔재라
 *   복제하지 않고 장터 팔레트(navy·gold·orange)로 치환한다. DOM 치수(6열·174px 행·24칸/페이지)는 유지.
 * ★ **capacity·used 는 서버값이 정본**(계약 §4.2). 슬롯 확장으로 capacity 를 늘리지 않는다 —
 *   확장(`POST /inventory/expansions`)은 백엔드가 없어 **비활성 자리**(미호출)로만 둔다.
 * ★ 목업 카테고리 탭(정령카드/아바타)은 계약 데이터가 없어 **드롭** — 중립 "전체 아이템" 자리만 남긴다.
 * ★ 슬롯 번호는 **1-based** 로 배치한다(목업 표시 규약과 일치). 채운 슬롯은 `slotNo` 로 자리를 잡고,
 *   빈 슬롯은 번호만 표시한다. used===0 이면 빈 상태 안내 + 임시보관 링크를 함께 보인다.
 * ★ 그리드는 **반응형 리플로우**(모바일 2 · 태블릿 3 · PC 6열, FC-086 #1) — 가로 스크롤 없이
 *   폭에 맞춰 열을 접는다(`xs`=576px 목업 모바일 브레이크포인트 정합). 슬롯 수는 그대로.
 */

const PAGE_SIZE = 24

interface InventorySlotGridProps {
    capacity: number
    used: number
    items: InventoryItem[]
    /** 골드포스 파생 기준 시각(테스트 주입). 기본 Date.now(). */
    now?: number
}

function InventorySlotGrid({
    capacity,
    used,
    items,
    now,
}: InventorySlotGridProps) {
    const pageCount = Math.max(1, Math.ceil(capacity / PAGE_SIZE))
    const [page, setPage] = useState(0)
    const safePage = Math.min(page, pageCount - 1)

    // slotNo → 아이템 (1-based 배치). 같은 슬롯 중복은 나중 값이 이긴다(정상 데이터엔 없음).
    const bySlot = new Map<number, InventoryItem>()
    for (const item of items) bySlot.set(item.slotNo, item)

    const firstSlot = safePage * PAGE_SIZE + 1
    const lastSlot = Math.min(firstSlot + PAGE_SIZE - 1, capacity)
    const slotNumbers: number[] = []
    for (let slot = firstSlot; slot <= lastSlot; slot += 1)
        slotNumbers.push(slot)

    return (
        <section className="mx-auto max-w-[820px] overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            {/* 타이틀 바 — 아이콘 + 이름 + 임시보관 링크(목업 .mycard-title) */}
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-bright">
                        <TbLayoutGrid aria-hidden className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <strong className="block text-base font-bold text-gray-900">
                            아이템 보관함
                        </strong>
                        <small className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                            Inventory storage
                        </small>
                    </div>
                </div>
                <Link
                    to={paths.tempStorage}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-subtle px-3 py-2 text-xs font-bold text-orange-deep hover:bg-orange-subtle/70"
                >
                    <TbArchive aria-hidden className="size-4" />
                    임시 보관함
                </Link>
            </div>

            {/* 카테고리 — 정령카드/아바타는 계약 데이터 없음 → 드롭. 중립 "전체 아이템" 자리만 */}
            <div className="border-b border-line px-4 py-2.5">
                <span className="inline-block rounded-lg bg-navy/5 px-3 py-1.5 text-xs font-bold text-navy">
                    전체 아이템
                </span>
            </div>

            {/* capacity 배지 — 서버값(used/capacity). 확장으로 늘리지 않는다 */}
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
                <span className="rounded-full border border-line bg-surface-sunken px-3 py-1.5 text-xs font-bold text-navy">
                    {used} / {capacity} 사용
                </span>
                {used === 0 && (
                    <span className="text-xs text-gray-400">
                        보유한 아이템이 없습니다.
                    </span>
                )}
            </div>

            {/* 슬롯 그리드 — 반응형 리플로우(모바일 2·태블릿 3·PC 6열, FC-086 #1) */}
            <div className="p-4">
                <ul
                    className="grid grid-cols-2 gap-2.5 xs:grid-cols-3 xl:grid-cols-6"
                    aria-label={`인벤토리 슬롯 ${firstSlot}–${lastSlot}`}
                >
                    {slotNumbers.map((slotNo) => {
                        const item = bySlot.get(slotNo)
                        return (
                            <li key={slotNo}>
                                {item ? (
                                    <FilledSlot item={item} now={now} />
                                ) : (
                                    <EmptySlot slotNo={slotNo} />
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>

            {/* 슬롯 확장 — 백엔드 미구현(§5) → 비활성 자리(미호출). capacity 불변 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                    <TbLock aria-hidden className="size-3.5" />
                    슬롯 확장은 준비 중입니다.
                </span>
                <button
                    disabled
                    type="button"
                    aria-disabled="true"
                    title="슬롯 확장은 준비 중입니다"
                    className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400"
                >
                    슬롯 확장
                </button>
            </div>

            {/* 페이지 탭 — 24칸/페이지(목업 .mycard-tabs). 한 페이지면 감춘다 */}
            {pageCount > 1 && (
                <nav
                    aria-label="인벤토리 슬롯 페이지"
                    className="grid border-t border-line"
                    style={{
                        gridTemplateColumns: `repeat(${pageCount}, minmax(0, 1fr))`,
                    }}
                >
                    {Array.from({ length: pageCount }, (_, index) => {
                        const start = index * PAGE_SIZE + 1
                        const end = Math.min(start + PAGE_SIZE - 1, capacity)
                        const active = index === safePage
                        return (
                            <button
                                key={index}
                                type="button"
                                aria-pressed={active}
                                aria-label={`슬롯 ${start}번부터 ${end}번`}
                                className={`relative border-e border-line py-3 text-center text-xs font-bold last:border-e-0 ${
                                    active
                                        ? 'bg-orange-subtle/40 text-orange-deep'
                                        : 'text-gray-500 hover:bg-gray-50'
                                }`}
                                onClick={() => setPage(index)}
                            >
                                {active && (
                                    <span
                                        aria-hidden
                                        className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-orange"
                                    />
                                )}
                                {index === 0 ? '기본 슬롯' : `${start}–${end}`}
                            </button>
                        )
                    })}
                </nav>
            )}
        </section>
    )
}

/**
 * 채운 슬롯 — 72×134 프레임을 **공용 스프라이트 스테이지**(다크 아웃라인) 박스에 담는다(§4).
 *
 * ★ **이미지 중심**(FC-102): 하단 이름 라벨을 제거하고, 스테이지 박스를 곧 슬롯 셀로 삼아
 *   여백(패딩·갭) 없이 셀에 꽉 채운다. 프레임(72×134)은 셀보다 좁으므로 중앙에 두고 다크
 *   아웃라인이 셀 폭을 메운다 — 프레임 아트 비율(72×134·크로마키)은 불변(외부 셀 크기로만 정합).
 *   이름은 링크 `aria-label` 로만 접근성 노출한다.
 */
function FilledSlot({ item, now }: { item: InventoryItem; now?: number }) {
    const { art, hasSkill } = deriveItemSummaryArt(item.summary)
    const name = item.summary.displayName

    return (
        <Link
            to={itemDetailPath(item.itemInstancePublicId)}
            aria-label={`${name} 상세 보기`}
            className="item-sprite-stage flex h-[134px] items-center justify-center overflow-hidden rounded-xl border border-line transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-navy hover:shadow-md"
            style={
                art?.src
                    ? ({
                          '--item-sprite': `url("${art.src}")`,
                      } as CSSProperties)
                    : undefined
            }
        >
            <ItemFrame
                imageUrl={art?.src}
                spriteUrl={art?.src}
                name={name}
                visual={{ goldforceExpireAt: item.summary.goldforceExpireAt }}
                hasSkill={hasSkill}
                size="frame"
                now={now}
            />
        </Link>
    )
}

/** 빈 슬롯 — 번호만(목업 .mycard-slot.is-empty). 상호작용 없음. 채운 슬롯과 셀 높이 정합(134px). */
function EmptySlot({ slotNo }: { slotNo: number }) {
    return (
        <div
            aria-label={`빈 슬롯 ${slotNo}`}
            className="relative flex h-[134px] items-center justify-center rounded-xl border border-dashed border-line bg-surface-sunken"
        >
            <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-2xl font-light text-gray-300"
            >
                +
            </span>
            <span
                aria-hidden
                className="absolute bottom-1.5 right-2 text-[9px] font-bold text-gray-300"
            >
                {String(slotNo).padStart(2, '0')}
            </span>
        </div>
    )
}

export default InventorySlotGrid
