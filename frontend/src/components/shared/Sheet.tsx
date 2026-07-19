import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { PiXBold } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import classNames from '@/utils/classNames'
import './sheet.css'
import type { ReactNode } from 'react'

/**
 * 모달 시트 (FC-059 `FilterSheet` → FC-064 에서 `components/shared/Sheet` 로 일반화).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **왜 옮기고 일반화했나 — 초점 가둠을 두 벌 갖지 않기 위해서다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * FC-064 가 모달을 둘 더 필요로 한다(입찰 바텀시트 · 아트 확대 라이트박스). 셋 다 하는 일은
 * **완전히 같다** — 포털 · `role="dialog"` · 초점 이동/가둠/복귀 · Escape · 배경 스크롤 잠금.
 * 다른 건 **패널의 기하**뿐이라 `placement` 하나로 갈랐다. 복제했다면 접근성 세부 6가지가
 * 세 곳에서 각자 표류한다(그중 하나만 초점 복귀를 빠뜨려도 키보드 사용자가 문서 처음으로 튕긴다).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ 템플릿 `Drawer`/`Dialog` 를 못 쓴 이유 = `framer-motion`(FC-057 성과 보존). 그 대신
 *    **모달로서 해야 할 일을 직접 다 한다** — 빠뜨리면 "보이기만 하는 시트"가 된다:
 * ══════════════════════════════════════════════════════════════════════════════
 *   ① `role="dialog" aria-modal` + `aria-labelledby` — 무엇이 열렸는지 읽힌다
 *   ② **초점 이동**: 열리면 시트 안으로, 닫히면 **눌렀던 버튼으로 되돌린다.**
 *      되돌리지 않으면 초점이 `<body>` 로 떨어져 키보드 사용자가 문서 처음으로 튕긴다.
 *   ③ **초점 가둠**: Tab 이 시트 밖으로 새면 뒤에 있는(시각적으로 가려진) 목록 링크에
 *      초점이 가서 **보이지 않는 곳을 조작**하게 된다
 *   ④ `Escape` 로 닫기 — 모달의 기본 계약
 *   ⑤ **배경 스크롤 잠금** — 시트를 넘겨 끝에 닿으면 뒤의 목록이 딸려 스크롤된다
 *   ⑥ `createPortal` — 시트를 `body` 로 뺀다. 화면 컨테이너에는 `overflow-x-hidden` 과
 *      `sticky` 가 걸려 있어 그 안에 `fixed` 를 두면 **컨테이닝 블록이 바뀌어** 시트가
 *      화면이 아니라 컨테이너에 갇힌다(뷰포트 하단에 붙지 않는다)
 *
 * ★ **시트 높이는 `max-h-[85dvh]`** — `vh` 는 모바일 주소창이 접힐 때의 높이라 실제보다
 *   크고, 그만큼 하단 액션이 화면 밖으로 밀린다. `dvh` 는 지금 보이는 높이다.
 */

interface SheetProps {
    open: boolean
    title: string
    onClose: () => void
    /** 시트를 연 버튼. 닫을 때 초점을 여기로 되돌린다 */
    triggerRef: React.RefObject<HTMLButtonElement | null>
    /**
     * `bottom` = 화면 하단에 붙는 바텀시트(필터·입찰).
     * `center` = 가운데 뜨는 라이트박스(아트 확대).
     */
    placement?: 'bottom' | 'center'
    /** 하단 고정 액션 */
    footer?: ReactNode
    /** 닫기 버튼의 접근명. 무엇을 닫는지 구분된다 */
    closeLabel?: string
    /** 바깥 래퍼 클래스 — 반응형 노출 제어(`lg:hidden` 등)에 쓴다 */
    className?: string
    'data-testid'?: string
    children: ReactNode
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** 기하만 다르다 — 접근성 동작은 위에서 공유한다. */
const PANEL_CLASS = {
    bottom: 'fc-sheet-panel absolute inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl',
    center: 'fc-sheet-center absolute inset-x-4 top-1/2 mx-auto max-h-[85dvh] max-w-lg -translate-y-1/2 rounded-2xl sm:inset-x-6',
} as const

const Sheet = ({
    open,
    title,
    onClose,
    triggerRef,
    placement = 'bottom',
    footer,
    closeLabel = '닫기',
    className,
    'data-testid': testId,
    children,
}: SheetProps) => {
    const panelRef = useRef<HTMLDivElement>(null)
    const headingId = `sheet-title-${placement}`

    useEffect(() => {
        if (!open) return

        const panel = panelRef.current
        /*
         * ★ 트리거를 **열릴 때 붙잡아 둔다.** 정리 함수에서 `triggerRef.current` 를 읽으면
         *   그 시점의 값이라 보장이 없다(리렌더로 노드가 갈리면 사라진 요소를 가리킨다).
         *   초점을 되돌릴 대상은 "이 시트를 연 그 버튼"이므로 여는 순간의 것이 정답이다.
         */
        const trigger = triggerRef.current
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // 닫기 버튼이 아니라 패널 자체에 초점을 준다 — 시트 제목이 먼저 읽힌다.
        panel?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                onClose()
                return
            }
            if (event.key !== 'Tab' || !panel) return

            // ③ 초점 가둠 — 양 끝에서 반대쪽으로 감는다.
            const focusables = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE),
            ).filter((element) => element.offsetParent !== null)
            if (focusables.length === 0) return

            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            const active = document.activeElement

            if (event.shiftKey && (active === first || active === panel)) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previous
            // ② 초점을 트리거로 되돌린다. 트리거가 사라졌으면 아무것도 하지 않는다.
            trigger?.focus()
        }
    }, [open, onClose, triggerRef])

    if (!open) return null

    return createPortal(
        <div
            className={classNames('fixed inset-0 z-50', className)}
            data-testid={testId}
        >
            {/*
             * 배경은 클릭으로 닫힌다. 키보드 경로는 Escape 와 닫기 버튼이 이미 있으므로
             * 이 요소는 `aria-hidden` 이며 보조기술에는 존재하지 않는다(중복 조작 없음).
             */}
            <div
                aria-hidden="true"
                className="fc-sheet-backdrop absolute inset-0 bg-gray-900/50"
                onClick={onClose}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                tabIndex={-1}
                className={classNames(
                    'flex flex-col bg-white shadow-2xl outline-hidden dark:bg-gray-800',
                    PANEL_CLASS[placement],
                )}
            >
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <h2
                        className="min-w-0 truncate text-base font-bold text-gray-900 dark:text-gray-100"
                        id={headingId}
                    >
                        {title}
                    </h2>
                    <Button
                        shape="circle"
                        size="xs"
                        type="button"
                        aria-label={closeLabel}
                        icon={<PiXBold />}
                        onClick={onClose}
                    />
                </header>

                {/* 본문만 스크롤한다 — 머리와 하단 액션은 늘 보인다. */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                    {children}
                </div>

                {footer && (
                    <div className="shrink-0 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    )
}

export default Sheet
