import { TbX } from 'react-icons/tb'
import ListSearchBar from '@/components/common/ListSearchBar'
import ListFilterSelect from '@/components/common/ListFilterSelect'
import { elementLabelOf } from '@/features/item/lib/element'
import {
    AUCTION_SORT_OPTIONS,
    AUCTION_STATUS_OPTIONS,
    RELEVANCE_SORT_OPTION,
    activeFilterChipsOf,
    searchPatch,
    type AuctionFilterState,
} from '@/features/auction/lib/auctionFilters'
import {
    elementOptions,
    subGroupOptions,
} from '@/features/auction/lib/filterOptions'
import type { ItemTemplate } from '@/lib/api/itemTemplates'

/**
 * 경매 필터 명령 바 (FC-071 — 목업 `#auction` `.auction-command` · 검색 FC-108).
 *
 * 목업 구성 그대로: **대분류 pills**(전체/무기/방어구/마법) + **select 3개**(속성·상태·정렬).
 * 목업에 없는 축(레벨·가격·골드포스·종류)·별도 시트는 두지 않는다 — 목업이 가진 필터만.
 *
 * ★ **자유문 검색(`q`)은 카드 상단 목록 검색바로**(FC-108 · 계약 C1). 상단 전역 검색이 아니다
 *   (mockup §5.2). q 가 있을 때만 정렬에 **관련도순**을 노출한다(계약 C2 — 무 q relevance 는 400).
 * ★ pills·select 값은 보존 `normalizeFilters`(상위 `onChange`)를 거쳐 URL 에 동기화된다.
 * ★ **선택 상태는 DOM 속성**(`aria-pressed`)으로 — 색만 바꾸지 않는다(WCAG 4.1.2).
 * ★ 색은 브랜드 토큰(navy) — 목업의 pill active 블루(#3867df)는 폐기 팔레트라 navy 로 맞춘다.
 * ★ 모바일: pills 가로 스크롤 + select 풀폭(목업 `@576`). 별도 시트 없음.
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
    const subGroups = subGroupOptions(templates)
    const elements = elementOptions(templates)
    const chips = activeFilterChipsOf(filters)
    // 관련도순은 q 가 있을 때만 — 무 q 조합은 서버 400(계약 C2)이라 UI 가 만들지 않는다.
    const sortOptions = filters.q
        ? [RELEVANCE_SORT_OPTION, ...AUCTION_SORT_OPTIONS]
        : AUCTION_SORT_OPTIONS

    const pill = (code: number | null, label: string) => {
        const active = filters.subGroup === code
        return (
            <button
                key={label}
                type="button"
                aria-pressed={active}
                className={`min-h-[40px] shrink-0 rounded-lg border px-3.5 text-sm font-bold transition-colors ${
                    active
                        ? 'border-brand-structure bg-brand-structure text-on-strong'
                        : 'border-content-line bg-content-surface text-content-muted hover:border-brand-structure'
                }`}
                onClick={() => onChange({ subGroup: code, kind: null })}
            >
                {label}
            </button>
        )
    }

    return (
        <section aria-label="경매 필터" className="flex flex-col gap-3">
            <div
                data-list-filter-surface
                className="rounded-2xl border border-content-line bg-content-surface p-4"
            >
                {/* 자유문 검색(FC-108) — 페이지 내 목록 검색. 상단 전역검색 아님(mockup §5.2) */}
                <ListSearchBar
                    value={filters.q ?? ''}
                    label="경매 아이템 검색"
                    placeholder="아이템 이름으로 검색"
                    onChange={(q) => onChange(searchPatch(filters, q))}
                />

                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-5">
                    {/* 대분류 pills — 목업 filter-primary */}
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {pill(null, '전체')}
                        {subGroups.map((option) =>
                            pill(option.code, option.label),
                        )}
                    </div>

                    {/* 속성·상태·정렬 — 목업 filter-secondary */}
                    <div className="grid min-w-0 grid-cols-1 gap-2 xs:grid-cols-3">
                        <ListFilterSelect
                            label="속성"
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
                                <option key={option.code} value={option.code}>
                                    {elementLabelOf(option.code)}
                                </option>
                            ))}
                        </ListFilterSelect>

                        <ListFilterSelect
                            label="상태"
                            value={filters.status ?? ''}
                            onChange={(event) =>
                                onChange({ status: event.target.value || null })
                            }
                        >
                            {AUCTION_STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </ListFilterSelect>

                        <ListFilterSelect
                            label="정렬"
                            value={filters.sort}
                            onChange={(event) =>
                                onChange({ sort: event.target.value })
                            }
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </ListFilterSelect>
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
                            className="flex items-center gap-1 rounded-full bg-brand-structure/5 py-1 pl-3 pr-2 text-xs font-medium text-chrome-selected hover:bg-brand-structure/10"
                            onClick={() => onChange(chip.patch)}
                        >
                            {chip.label}
                            <TbX aria-hidden className="size-3.5" />
                        </button>
                    ))}
                    <button
                        type="button"
                        className="text-xs font-bold text-content-subtle underline-offset-2 hover:underline"
                        onClick={onReset}
                    >
                        전체 초기화
                    </button>
                </div>
            )}
        </section>
    )
}

export default AuctionFilters

