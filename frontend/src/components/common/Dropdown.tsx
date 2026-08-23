import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * 최소 드롭다운 (FC-067 — 상단 알림·프로필 메뉴용).
 *
 * ★ 셸에 필요한 만큼만 구현한다(과설계 금지). 바깥 클릭·Esc 로 닫히고, 트리거는
 *   `aria-expanded`/`aria-haspopup` 을 노출한다(HANDOVER §24 키보드 조작).
 * ★ 패널 항목 클릭 시 자동으로 닫는다(`onClick` 캡처). 무거운 팝오버 라이브러리를 끌어오지 않는다.
 */

interface DropdownProps {
    /** 트리거 버튼 내용 */
    trigger: ReactNode
    /** 트리거 접근성 이름(아이콘 전용 버튼 필수) */
    triggerLabel: string
    triggerClassName?: string
    /** 패널 내용 */
    children: ReactNode
    /** 정렬 — 기본 우측 */
    align?: 'left' | 'right'
    /** 패널 폭 클래스 */
    panelClassName?: string
}

function Dropdown({
    trigger,
    triggerLabel,
    triggerClassName = '',
    children,
    align = 'right',
    panelClassName = 'w-72',
}: DropdownProps) {
    const [open, setOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const panelId = useId()

    useEffect(() => {
        if (!open) return
        const onPointer = (e: MouseEvent) => {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onPointer)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                aria-label={triggerLabel}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                className={triggerClassName}
                onClick={() => setOpen((v) => !v)}
            >
                {trigger}
            </button>
            {open && (
                <div
                    id={panelId}
                    role="menu"
                    data-floating-align={align}
                    className={`app-chrome app-floating-menu absolute z-50 mt-2 overflow-hidden rounded-xl border border-chrome-selected bg-chrome-raised text-chrome-fg shadow-lg ${
                        align === 'right' ? 'right-0' : 'left-0'
                    } ${panelClassName}`}
                    onClick={() => setOpen(false)}
                >
                    {children}
                </div>
            )}
        </div>
    )
}

export default Dropdown
