import { useEffect, useId, useState } from 'react'
import { elementLabelOf } from '@/features/item/lib/element'
import {
    AUCTION_STATUS_OPTIONS,
    type AuctionFilterState,
} from '@/features/auction/lib/auctionFilters'
import {
    elementOptions,
    kindOptions,
} from '@/features/auction/lib/filterOptions'
import type { ItemTemplate } from '@/lib/api/itemTemplates'

/**
 * 경매 필터 컨트롤 묶음 (FC-071) — **인라인 바(데스크톱)와 시트(모바일)가 공유**한다.
 *
 * ★ 대분류(pills)·정렬은 항상 보이는 바가 갖고, 여기는 **나머지 축**을 담는다:
 *   속성·상태·종류(subGroup 종속)·레벨 범위·가격 범위·골드포스.
 * ★ 모든 변경은 **즉시 상위 상태로**(라이브). 범위 입력만 **blur/Enter 커밋**으로 매 타건
 *   재조회를 막는다. 값 정규화(음수·소수·역전)는 `normalizeFilters` 가 최종 처리한다.
 * ★ **종류는 `subGroup` 종속** — 대분류 미선택이면 `disabled`(DOM 속성, 색만 죽이지 않는다).
 */

interface ControlsProps {
    filters: AuctionFilterState
    onChange: (patch: Partial<AuctionFilterState>) => void
    templates: readonly ItemTemplate[]
    layout: 'bar' | 'sheet'
    className?: string
}

/** blur/Enter 에서만 커밋하는 숫자 입력 — 매 타건 URL·쿼리 churn 방지. */
function NumberField({
    value,
    onCommit,
    placeholder,
    ariaLabel,
}: {
    value: number | null
    onCommit: (next: number | null) => void
    placeholder: string
    ariaLabel: string
}) {
    const [text, setText] = useState(value === null ? '' : String(value))

    // 밖에서 값이 바뀌면(초기화·범위 스왑) 표시를 맞춘다.
    useEffect(() => {
        setText(value === null ? '' : String(value))
    }, [value])

    const commit = () => {
        const trimmed = text.trim()
        onCommit(trimmed === '' ? null : Number(trimmed))
    }

    return (
        <input
            type="text"
            inputMode="numeric"
            value={text}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm font-medium text-gray-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30"
            onChange={(event) => setText(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    commit()
                }
            }}
        />
    )
}

function Field({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold text-gray-500">
            <span>{label}</span>
            {children}
        </label>
    )
}

const SELECT_CLASS =
    'min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-gray-900 focus:border-orange focus:outline-none focus:ring-2 focus:ring-orange/30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400'

function AuctionFilterControls({
    filters,
    onChange,
    templates,
    layout,
    className = '',
}: ControlsProps) {
    const goldforceId = useId()
    const elements = elementOptions(templates)
    const kinds = kindOptions(filters.subGroup, templates)
    const kindDisabled = filters.subGroup === null

    const wrapClass =
        layout === 'bar'
            ? `flex flex-wrap items-end gap-3 ${className}`
            : `grid grid-cols-1 gap-4 xs:grid-cols-2 ${className}`

    return (
        <div className={wrapClass.trim()}>
            <Field label="속성">
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
                        <option key={option.code} value={option.code}>
                            {elementLabelOf(option.code)}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="종류">
                <select
                    className={SELECT_CLASS}
                    value={filters.kind ?? ''}
                    disabled={kindDisabled}
                    aria-describedby={
                        kindDisabled ? `${goldforceId}-kind-hint` : undefined
                    }
                    onChange={(event) =>
                        onChange({
                            kind: event.target.value
                                ? Number(event.target.value)
                                : null,
                        })
                    }
                >
                    <option value="">
                        {kindDisabled ? '대분류 먼저 선택' : '전체 종류'}
                    </option>
                    {kinds.map((option) => (
                        <option key={option.code} value={option.code}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {kindDisabled && (
                    <span
                        id={`${goldforceId}-kind-hint`}
                        className="text-[10px] font-medium text-gray-400"
                    >
                        대분류를 고르면 종류가 열립니다
                    </span>
                )}
            </Field>

            <Field label="상태">
                <select
                    className={SELECT_CLASS}
                    value={filters.status ?? ''}
                    onChange={(event) =>
                        onChange({
                            status: event.target.value || null,
                        })
                    }
                >
                    {AUCTION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="레벨">
                <span className="flex items-center gap-1.5">
                    <NumberField
                        value={filters.minLevel}
                        placeholder="최소"
                        ariaLabel="최소 레벨"
                        onCommit={(next) => onChange({ minLevel: next })}
                    />
                    <span className="text-gray-300">~</span>
                    <NumberField
                        value={filters.maxLevel}
                        placeholder="최대"
                        ariaLabel="최대 레벨"
                        onCommit={(next) => onChange({ maxLevel: next })}
                    />
                </span>
            </Field>

            <Field label="가격(코드)">
                <span className="flex items-center gap-1.5">
                    <NumberField
                        value={filters.minPrice}
                        placeholder="최소"
                        ariaLabel="최소 가격"
                        onCommit={(next) => onChange({ minPrice: next })}
                    />
                    <span className="text-gray-300">~</span>
                    <NumberField
                        value={filters.maxPrice}
                        placeholder="최대"
                        ariaLabel="최대 가격"
                        onCommit={(next) => onChange({ maxPrice: next })}
                    />
                </span>
            </Field>

            <label
                htmlFor={goldforceId}
                className="flex items-center gap-2 self-end py-2 text-sm font-medium text-gray-700"
            >
                <input
                    id={goldforceId}
                    type="checkbox"
                    checked={filters.goldforceActive}
                    className="size-4 rounded border-line text-orange focus:ring-orange/30"
                    onChange={(event) =>
                        onChange({ goldforceActive: event.target.checked })
                    }
                />
                골드포스만
            </label>
        </div>
    )
}

export default AuctionFilterControls
