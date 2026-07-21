import { useEffect, useRef } from 'react'
import { TbX } from 'react-icons/tb'
import type { AuctionFilterState } from '@/features/auction/lib/auctionFilters'
import type { ItemTemplate } from '@/lib/api/itemTemplates'
import AuctionFilterControls from './AuctionFilterControls'

/**
 * 모바일 필터 시트 (FC-071 — FC-064 C-1 승계).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **초점 강탈 방지: 부수효과 effect 의 의존은 `[open]` 하나뿐이다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 목록은 `useNow()` 로 **매초 리렌더**된다. `onClose`·`onReset` 같은 콜백을 effect 의존에 넣으면
 * 초당 effect 가 재실행돼 **초점을 매초 강탈**하고, 모바일에선 그 순간 키보드가 닫힌다(FC-064).
 * 그래서 콜백은 **ref 로만 읽고**, 초점/스크롤잠금/Escape/리사이즈 배선은 `[open]` 이 바뀔 때만
 * 건다. 값이 매초 바뀌어도 이 effect 는 다시 돌지 않는다.
 *
 * ★★ **데스크톱 리사이즈 시 스크롤 잠금 잔존 방지(m-6).** 이 시트는 `lg:hidden` 이라 폭이
 *    데스크톱으로 커지면 **화면에서 사라지지만 상태(open)와 body 스크롤 잠금은 남는다** — 페이지가
 *    스크롤 불가로 얼어붙는다. `matchMedia` 로 데스크톱 전이를 듣고 **상태까지 닫아** 잠금을 푼다.
 *
 * ★ 시트는 **내부에서 닫는다**(자기 콜백 호출) — 부모가 렌더마다 prop 을 바꿔 강제로 여닫지 않는다.
 */

interface FilterSheetProps {
    open: boolean
    onClose: () => void
    onReset: () => void
    filters: AuctionFilterState
    onChange: (patch: Partial<AuctionFilterState>) => void
    templates: readonly ItemTemplate[]
}

/** 데스크톱 경계 — AppShell 사이드바가 상시 노출되는 폭(tailwind lg). */
const DESKTOP_QUERY = '(min-width: 1024px)'

function FilterSheet({
    open,
    onClose,
    onReset,
    filters,
    onChange,
    templates,
}: FilterSheetProps) {
    const panelRef = useRef<HTMLDivElement | null>(null)
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!open) return

        const body = document.body
        const previousOverflow = body.style.overflow
        body.style.overflow = 'hidden'

        // 첫 초점 — 패널 안 첫 포커서블. (매초 리렌더에도 이 effect 는 재실행되지 않는다.)
        const focusTarget = panelRef.current?.querySelector<HTMLElement>(
            'button, select, input, [tabindex]:not([tabindex="-1"])',
        )
        focusTarget?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCloseRef.current()
        }
        document.addEventListener('keydown', onKeyDown)

        // 데스크톱 전이 → 상태까지 닫아 스크롤 잠금 잔존(m-6)을 없앤다.
        const media = window.matchMedia(DESKTOP_QUERY)
        const onDesktop = (event: MediaQueryListEvent) => {
            if (event.matches) onCloseRef.current()
        }
        if (media.matches) onCloseRef.current()
        media.addEventListener?.('change', onDesktop)

        return () => {
            body.style.overflow = previousOverflow
            document.removeEventListener('keydown', onKeyDown)
            media.removeEventListener?.('change', onDesktop)
        }
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="경매 상세 필터"
        >
            <button
                type="button"
                aria-label="필터 닫기"
                className="absolute inset-0 bg-navy-900/50"
                onClick={onClose}
            />

            <div
                ref={panelRef}
                className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-surface shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="text-base font-bold text-gray-900">
                        상세 필터
                    </h2>
                    <button
                        type="button"
                        aria-label="닫기"
                        className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    <AuctionFilterControls
                        filters={filters}
                        templates={templates}
                        layout="sheet"
                        onChange={onChange}
                    />
                </div>

                <div className="flex gap-2 border-t border-line px-5 py-4">
                    <button
                        type="button"
                        className="flex-1 rounded-lg border border-line py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100"
                        onClick={onReset}
                    >
                        초기화
                    </button>
                    <button
                        type="button"
                        className="flex-[2] rounded-lg bg-navy py-2.5 text-sm font-bold text-white hover:bg-navy-800"
                        onClick={onClose}
                    >
                        결과 보기
                    </button>
                </div>
            </div>
        </div>
    )
}

export default FilterSheet
