import { useState } from 'react'
import { TbAdjustmentsHorizontal, TbX } from 'react-icons/tb'
import {
    AUCTION_SORT_OPTIONS,
    activeFilterChipsOf,
    countActiveFilters,
    type AuctionFilterState,
} from '@/features/auction/lib/auctionFilters'
import { subGroupOptions } from '@/features/auction/lib/filterOptions'
import type { ItemTemplate } from '@/lib/api/itemTemplates'
import AuctionFilterControls from './AuctionFilterControls'
import FilterSheet from './FilterSheet'

/**
 * 경매 필터 명령 바 (FC-071 — 목업 `.auction-command` + design-brief B-2).
 *
 * 목업 구성을 계약 필터에 맞춰 옮긴다: **대분류 pills + 정렬**은 항상 보이는 바에, 나머지 축은
 * 데스크톱에선 **인라인**(`lg:flex`), 모바일에선 **시트**(`FilterSheet`)에 담는다 —
 * "웹은 웹, 모바일은 모바일"(design-brief C-7). 적용된 필터는 **칩**으로 되짚어 개별 해제한다.
 *
 * ★ 대분류 pills 는 목업의 전체/무기/방어구/마법 그대로. `전체 = null`, 선택 시 종속 `kind` 는
 *   `normalizeFilters`(상위 `onChange`)가 정리한다.
 * ★ 선택 상태는 **DOM 속성**으로 표시한다(`aria-pressed`) — 색만 바꾸지 않는다(WCAG 4.1.2).
 */

interface AuctionFiltersProps {
    filters: AuctionFilterState
    /** 축 하나(또는 칩 patch)를 병합·정규화해 URL 에 반영한다(상위 소관) */
    onChange: (patch: Partial<AuctionFilterState>) => void
    onReset: () => void
    templates: readonly ItemTemplate[]
}

function AuctionFilters({
    filters,
    onChange,
    onReset,
    templates,
}: AuctionFiltersProps) {
    const [sheetOpen, setSheetOpen] = useState(false)
    const subGroups = subGroupOptions(templates)
    const chips = activeFilterChipsOf(filters)
    const activeCount = countActiveFilters(filters)

    const pill = (code: number | null, label: string) => {
        const active = filters.subGroup === code
        return (
            <button
                key={label}
                type="button"
                aria-pressed={active}
                className={`min-h-[40px] rounded-lg border px-3.5 text-sm font-bold transition-colors ${
                    active
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-surface text-gray-600 hover:border-navy'
                }`}
                onClick={() => onChange({ subGroup: code, kind: null })}
            >
                {label}
            </button>
        )
    }

    return (
        <section aria-label="경매 필터" className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    {/* 대분류 pills — 항상 노출(목업 filter-primary) */}
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {pill(null, '전체')}
                        {subGroups.map((option) =>
                            pill(option.code, option.label),
                        )}
                    </div>

                    <div className="flex items-end gap-2">
                        {/* 정렬 — 항상 노출 */}
                        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold text-gray-500">
                            <span>정렬</span>
                            <select
                                value={filters.sort}
                                className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-gray-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30"
                                onChange={(event) =>
                                    onChange({ sort: event.target.value })
                                }
                            >
                                {AUCTION_SORT_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* 모바일 전용 — 상세 필터 시트 열기 */}
                        <button
                            type="button"
                            className="flex items-center gap-1.5 self-end rounded-lg border border-line px-3 py-2 text-sm font-bold text-gray-700 hover:border-navy lg:hidden"
                            onClick={() => setSheetOpen(true)}
                        >
                            <TbAdjustmentsHorizontal
                                aria-hidden
                                className="size-4"
                            />
                            필터
                            {activeCount > 0 && (
                                <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">
                                    {activeCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* 데스크톱 인라인 상세 필터 */}
                <AuctionFilterControls
                    filters={filters}
                    templates={templates}
                    layout="bar"
                    className="mt-4 hidden border-t border-line pt-4 lg:flex"
                    onChange={onChange}
                />
            </div>

            {/* 적용된 필터 칩 — 개별 해제(정규화가 뒤처리) */}
            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {chips.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            className="flex items-center gap-1 rounded-full bg-navy/5 py-1 pl-3 pr-2 text-xs font-medium text-navy-700 hover:bg-navy/10"
                            aria-label={`${chip.label} 필터 해제`}
                            onClick={() => onChange(chip.patch)}
                        >
                            {chip.label}
                            <TbX aria-hidden className="size-3.5" />
                        </button>
                    ))}
                    <button
                        type="button"
                        className="text-xs font-bold text-gray-500 underline-offset-2 hover:underline"
                        onClick={onReset}
                    >
                        전체 초기화
                    </button>
                </div>
            )}

            <FilterSheet
                open={sheetOpen}
                filters={filters}
                templates={templates}
                onClose={() => setSheetOpen(false)}
                onReset={onReset}
                onChange={onChange}
            />
        </section>
    )
}

export default AuctionFilters
