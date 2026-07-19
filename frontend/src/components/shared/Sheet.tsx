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
    /**
     * 이 폭 이상에서는 시트를 **쓰지 않는 화면**임을 선언한다(모바일 전용 시트).
     *
     * ★★ **숨김 클래스와 자동 닫힘을 한 prop 으로 묶은 이유** — 예전엔 소비처가
     *    `className="lg:hidden"` 만 넘겼고, 시트를 연 채 데스크톱 폭으로 리사이즈하면
     *    **시트는 사라지는데 열림 상태는 남아** 스크롤 잠금과 초점 가둠이 유지됐다.
     *    보이지 않는 다이얼로그에 갇히는 것이다(FC-064 리뷰 m-6). 둘을 갈라 두면
     *    **한쪽만 붙이는 실수가 언제든 다시 난다** — 묶으면 구조적으로 불가능하다.
     */
    hiddenAbove?: 'lg'
    /** 바깥 래퍼 클래스 */
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

/**
 * 숨김 브레이크포인트 ↔ 미디어쿼리 짝.
 * ★ 클래스 문자열을 **리터럴로** 둔다 — Tailwind 는 소스를 정적으로 훑으므로
 *   `lg:hidden` 을 조립해 만들면 그 클래스가 CSS 에 생성되지 않는다.
 */
const HIDDEN_ABOVE = {
    lg: { className: 'lg:hidden', query: '(min-width: 1024px)' },
} as const

/**
 * 패널 안에서 **실제로 초점을 받을 수 있는** 요소들.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`offsetParent !== null` 을 무조건 걸면 초점 가둠이 테스트 불가가 된다** (리뷰 m-2).
 * ══════════════════════════════════════════════════════════════════════════════
 * jsdom 은 레이아웃을 계산하지 않아 `offsetParent` 가 **항상 null** 이다. 종전 구현은 그래서
 * 목록이 늘 비었고 `if (focusables.length === 0) return` 으로 **조기 반환** — 가둠 로직이
 * 한 줄도 실행되지 않았다. 일반화의 명분이 *"접근성 6항목의 단일 구현"* 인데 그중 하나가
 * 무테스트였던 셈이다.
 *
 * 그래서 **레이아웃 정보가 있는 환경에서만** 그 필터를 적용한다. 판별은 패널 자신으로 한다 —
 * 패널은 `position: absolute` 라 브라우저에서는 위치가 잡힌 조상(고정 래퍼)을 반드시 갖고,
 * jsdom 에서는 갖지 않는다. 브라우저 동작은 종전과 **완전히 같고**, jsdom 에서는 숨김 필터만
 * 빠져 나머지 가둠 로직이 그대로 검증된다.
 */
function visibleFocusables(panel: HTMLElement): HTMLElement[] {
    const layoutKnown = panel.offsetParent !== null
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => !layoutKnown || element.offsetParent !== null,
    )
}

const Sheet = ({
    open,
    title,
    onClose,
    triggerRef,
    placement = 'bottom',
    footer,
    closeLabel = '닫기',
    hiddenAbove,
    className,
    'data-testid': testId,
    children,
}: SheetProps) => {
    const panelRef = useRef<HTMLDivElement>(null)
    const headingId = `sheet-title-${placement}`
    const hidden = hiddenAbove ? HIDDEN_ABOVE[hiddenAbove] : null

    /*
     * ══════════════════════════════════════════════════════════════════════════
     * ★★ **부모의 리렌더가 초점을 건드리면 안 된다** (FC-064 리뷰 C-1).
     * ══════════════════════════════════════════════════════════════════════════
     * 종전 의존 배열은 `[open, onClose, triggerRef]` 였다. 소비처는 `onClose` 를 **인라인
     * 화살표**로 넘기고 상세·라이트박스의 부모는 `useNow()` 로 **매초 리렌더**한다. 그래서
     * 초당 한 번씩 `onClose` 의 신원이 바뀌어 effect 가 재실행됐고 —
     * **cleanup 이 트리거로, 본문이 패널로 초점을 옮겼다.**
     * 모바일에서는 그때마다 **소프트 키보드가 닫혀 금액을 타이핑할 수 없었다.**
     * 목록의 필터 시트도 필터를 만질 때마다 같은 일이 났다(FC-059 에서 승계된 결함).
     *
     * ★ **고치는 자리는 `Sheet` 안이다.** 소비처마다 `useCallback` 을 요구하는 해법은
     *   **네 번째 소비처에서 반드시 다시 표류한다** — 컴포넌트를 공용으로 만든 목적과 정면으로
     *   어긋난다. 콜백을 ref 에 담아 **의존에서 빼면** 규칙이 아니라 구조로 보장된다.
     *
     * ★ 이 effect 는 **의존이 없다**(매 렌더 실행). 아래 초점 effect 보다 **먼저 선언**해야
     *   열리는 렌더에서 최신 값이 이미 담겨 있다 — effect 는 선언 순서대로 실행된다.
     */
    const latest = useRef({ onClose, triggerRef })
    useEffect(() => {
        latest.current = { onClose, triggerRef }
    })

    /*
     * ★ 의존은 **`open` 하나뿐이다.** 열림/닫힘 전이에만 반응한다 — 초점 이동은 상태 전이의
     *   결과여야지 렌더의 결과여서는 안 된다.
     */
    useEffect(() => {
        if (!open) return

        const panel = panelRef.current
        /*
         * ★ 트리거를 **열릴 때 붙잡아 둔다.** 정리 함수에서 `triggerRef.current` 를 읽으면
         *   그 시점의 값이라 보장이 없다(리렌더로 노드가 갈리면 사라진 요소를 가리킨다).
         *   초점을 되돌릴 대상은 "이 시트를 연 그 버튼"이므로 여는 순간의 것이 정답이다.
         */
        const trigger = latest.current.triggerRef.current
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // 닫기 버튼이 아니라 패널 자체에 초점을 준다 — 시트 제목이 먼저 읽힌다.
        panel?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation()
                // 최신 콜백을 **이벤트 시점에** 읽는다 — 닫힌 값을 붙잡아 두지 않는다.
                latest.current.onClose()
                return
            }
            if (event.key !== 'Tab' || !panel) return

            // ③ 초점 가둠 — 양 끝에서 반대쪽으로 감는다.
            const focusables = visibleFocusables(panel)
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
    }, [open])

    /*
     * ★ 모바일 전용 시트는 **폭이 넓어지면 스스로 닫는다**(리뷰 m-6). 클래스로 감추기만 하면
     *   열림 상태가 남아 스크롤 잠금·초점 가둠이 보이지 않는 채로 계속된다.
     */
    useEffect(() => {
        if (!open || !hidden) return
        if (typeof window.matchMedia !== 'function') return

        const media = window.matchMedia(hidden.query)
        if (media.matches) {
            latest.current.onClose()
            return
        }

        const onChange = (event: MediaQueryListEvent) => {
            if (event.matches) latest.current.onClose()
        }
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [open, hidden])

    if (!open) return null

    return createPortal(
        <div
            className={classNames(
                'fixed inset-0 z-50',
                hidden?.className,
                className,
            )}
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
