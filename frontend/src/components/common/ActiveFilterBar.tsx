import { TbRefresh, TbX } from 'react-icons/tb'
import './ListBrowseMeta.css'

export interface ActiveFilterItem {
    id: string
    label: string
    onRemove: () => void
}

interface ActiveFilterBarProps {
    items: readonly ActiveFilterItem[]
    onReset: () => void
}

/** 목록 필터의 개별 해제·전체 초기화 동작을 공유하는 고대비 글래스 바. */
export default function ActiveFilterBar({
    items,
    onReset,
}: ActiveFilterBarProps) {
    if (items.length === 0) return null

    return (
        <div
            role="group"
            aria-label="적용된 조건"
            className="active-filter-bar"
        >
            <span className="active-filter-bar__label">적용된 조건</span>
            <div className="active-filter-bar__items">
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        aria-label={`${item.label} 필터 해제`}
                        className="active-filter-chip"
                        onClick={item.onRemove}
                    >
                        <span>{item.label}</span>
                        <TbX aria-hidden />
                    </button>
                ))}
            </div>
            <button
                type="button"
                className="active-filter-reset"
                onClick={onReset}
            >
                <TbRefresh aria-hidden />
                <span>전체 초기화</span>
            </button>
        </div>
    )
}
