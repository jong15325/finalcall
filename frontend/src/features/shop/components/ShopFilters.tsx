import { TbSearch, TbX } from 'react-icons/tb'
import { elementLabelOf } from '@/features/item/lib/element'
import {
    elementOptions,
    subGroupOptions,
} from '@/features/auction/lib/filterOptions'
import {
    SHOP_SORT_OPTIONS,
    activeShopFilterChipsOf,
    type ShopFilterState,
} from '@/features/shop/lib/shopFilters'
import type { ItemTemplate } from '@/lib/api/itemTemplates'

/**
 * 고정가 마켓 필터 바 (FC-094 — 목업 `market()` `.market-toolbar` 1:1).
 *
 * 목업 툴바 구성 그대로: **검색 입력(준비 중·비활성)** + **대분류 pills** + **속성·정렬 select**.
 * 검색은 목업 §9 대로 **페이지 내 "준비 중" 목업**이다 — 상단 전역검색이 아니고, 계약에 자유문
 * 검색이 없어 비활성 자리로만 둔다(경매 필터가 keyword 를 만들지 않은 것과 같은 판단).
 *
 * ★ pills·select 값은 보존 `normalizeShopFilters`(상위 `onChange`)를 거쳐 URL 에 동기화된다.
 * ★ **선택 상태는 DOM 속성**(`aria-pressed`) — 색만 바꾸지 않는다(WCAG 4.1.2).
 * ★ 색은 브랜드 토큰(navy) — 목업 Vuexy 블루는 폐기 팔레트라 구조/치수만 따르고 색은 토큰(경매 대칭).
 * ★ 모바일: pills 가로 스크롤 + select 풀폭(§9 반응형).
 */

interface ShopFiltersProps {
    filters: ShopFilterState
    /** 축 하나(또는 칩 patch)를 병합·정규화해 URL 에 반영한다(상위 소관) */
    onChange: (patch: Partial<ShopFilterState>) => void
    onReset: () => void
    templates: readonly ItemTemplate[]
}

const SELECT_CLASS =
    'w-full min-w-[125px] rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-gray-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30'

function ShopFilters({
    filters,
    onChange,
    onReset,
    templates,
}: ShopFiltersProps) {
    const subGroups = subGroupOptions(templates)
    const elements = elementOptions(templates)
    const chips = activeShopFilterChipsOf(filters)

    const pill = (code: number | null, label: string) => {
        const active = filters.subGroup === code
        return (
            <button
                key={label}
                type="button"
                aria-pressed={active}
                className={`min-h-[40px] shrink-0 rounded-lg border px-3.5 text-sm font-bold transition-colors ${
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
        <section aria-label="마켓 필터" className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
                {/* 검색(준비 중) — 목업 §9 페이지 내 목업. 상단 전역검색 아님 */}
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface-sunken px-3 py-2 text-sm text-gray-400">
                    <TbSearch aria-hidden className="size-4" />
                    <input
                        disabled
                        aria-label="아이템 검색 (준비 중)"
                        placeholder="아이템 검색 (준비 중)"
                        className="w-full min-w-0 flex-1 cursor-not-allowed bg-transparent outline-none placeholder:text-gray-400"
                    />
                    <span className="shrink-0 rounded-full bg-gold-subtle px-2 py-0.5 text-[10px] font-bold text-gold-deep">
                        준비 중
                    </span>
                </div>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
                    {/* 대분류 pills */}
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {pill(null, '전체')}
                        {subGroups.map((option) =>
                            pill(option.code, option.label),
                        )}
                    </div>

                    {/* 속성·정렬 select */}
                    <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
                        <label className="grid gap-1 text-[11px] font-bold text-gray-500">
                            <span>속성</span>
                            <select
                                className={SELECT_CLASS}
                                value={filters.element ?? ''}
                                onChange={(event) =>
                                    onChange({
                                        element: event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                    })
                                }
                            >
                                <option value="">전체 속성</option>
                                {elements.map((option) => (
                                    <option
                                        key={option.code}
                                        value={option.code}
                                    >
                                        {elementLabelOf(option.code)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="grid gap-1 text-[11px] font-bold text-gray-500">
                            <span>정렬</span>
                            <select
                                className={SELECT_CLASS}
                                value={filters.sort}
                                onChange={(event) =>
                                    onChange({ sort: event.target.value })
                                }
                            >
                                {SHOP_SORT_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>
            </div>

            {/* 적용된 필터 칩 — 개별 해제(정규화가 뒤처리) */}
            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {chips.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            aria-label={`${chip.label} 필터 해제`}
                            className="flex items-center gap-1 rounded-full bg-navy/5 py-1 pl-3 pr-2 text-xs font-medium text-navy-700 hover:bg-navy/10"
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
        </section>
    )
}

export default ShopFilters
