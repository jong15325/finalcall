import { TbChevronDown } from 'react-icons/tb'
import type { ChangeEvent, ReactNode } from 'react'

interface ListFilterSelectProps {
    label: string
    value: string | number
    onChange: (event: ChangeEvent<HTMLSelectElement>) => void
    children: ReactNode
    minWidth?: boolean
}

/** 목록 화면에서 공통으로 사용하는 다크 프로스트 셀렉트 컨트롤. */
export default function ListFilterSelect({
    label,
    value,
    onChange,
    children,
    minWidth = false,
}: ListFilterSelectProps) {
    return (
        <label data-list-filter-select className="grid min-w-0 gap-1.5">
            <span>{label}</span>
            <span data-list-filter-select-control className="min-w-0">
                <select
                    className={`w-full min-w-0 appearance-none bg-transparent px-3.5 py-2.5 pr-10 text-sm outline-none ${minWidth ? 'sm:min-w-[132px]' : ''}`}
                    value={value}
                    onChange={onChange}
                >
                    {children}
                </select>
                <TbChevronDown aria-hidden data-list-filter-select-icon />
            </span>
        </label>
    )
}

