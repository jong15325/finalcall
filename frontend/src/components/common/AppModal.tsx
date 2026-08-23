import { type ReactNode, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TbX } from 'react-icons/tb'
import AppModalButton from './AppModalButton'

const openModalStack: symbol[] = []
let bodyOverflowBeforeModal: string | null = null

function isTopModal(id: symbol) {
    return openModalStack.at(-1) === id
}

type AppModalSize = 'sm' | 'md' | 'lg' | 'xl'
type AppModalTone = 'default' | 'danger'

export interface AppModalAction {
    id: string
    label: ReactNode
    pendingLabel?: ReactNode
    variant?: 'primary' | 'secondary' | 'danger'
    type?: 'button' | 'submit'
    form?: string
    disabled?: boolean
    pending?: boolean
    autoFocus?: boolean
    close?: boolean
    onClick?: () => void
    buttonRef?: React.RefObject<HTMLButtonElement | null>
}

interface AppModalProps {
    open: boolean
    title: ReactNode
    eyebrow?: ReactNode
    titleIcon?: ReactNode
    children: ReactNode
    footer?: ReactNode
    actions?: readonly AppModalAction[]
    overlay?: ReactNode
    contentInert?: boolean
    onClose: () => void
    size?: AppModalSize
    tone?: AppModalTone
    closeDisabled?: boolean
    closeLabel?: string
    closeOnBackdrop?: boolean
    role?: 'dialog' | 'alertdialog'
    descriptionId?: string
    panelClassName?: string
    bodyClassName?: string
    bodyRef?: React.RefObject<HTMLDivElement | null>
    onBodyScroll?: React.UIEventHandler<HTMLDivElement>
    footerClassName?: string
    initialFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * 앱의 모든 폼/확인 모달이 공유하는 반응형 셸.
 * 모바일에서는 bottom sheet, sm 이상에서는 centered dialog로 전환하며
 * portal, focus trap/restore, body scroll lock, Escape/backdrop close를 한 곳에서 소유한다.
 */
export default function AppModal({
    open,
    title,
    eyebrow,
    titleIcon,
    children,
    footer,
    actions,
    overlay,
    contentInert = false,
    onClose,
    size = 'md',
    tone = 'default',
    closeDisabled = false,
    closeLabel = '닫기',
    closeOnBackdrop = true,
    role = 'dialog',
    descriptionId,
    panelClassName = '',
    bodyClassName = '',
    bodyRef,
    onBodyScroll,
    footerClassName = '',
    initialFocusRef,
}: AppModalProps) {
    const generatedId = useId().replace(/:/g, '')
    const titleId = `appModalTitle-${generatedId}`
    const modalIdRef = useRef(Symbol(titleId))
    const panelRef = useRef<HTMLDivElement>(null)
    const onCloseRef = useRef(onClose)
    const closeDisabledRef = useRef(closeDisabled)
    onCloseRef.current = onClose
    closeDisabledRef.current = closeDisabled

    useEffect(() => {
        if (!open) return
        const previousFocus =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
        const modalId = modalIdRef.current
        if (openModalStack.length === 0) {
            bodyOverflowBeforeModal = document.body.style.overflow
        }
        openModalStack.push(modalId)
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() => {
            const preferred = initialFocusRef?.current
            const autoFocus =
                panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
            const fallback = panelRef.current?.querySelector<HTMLElement>(
                'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
            )
            ;(preferred ?? autoFocus ?? fallback ?? panelRef.current)?.focus()
        })

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isTopModal(modalId)) return
            if (event.key === 'Escape' && !closeDisabledRef.current) {
                event.preventDefault()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab') return
            const focusables = Array.from(
                panelRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                ) ?? [],
            ).filter(
                (element) =>
                    !element.hasAttribute('disabled') &&
                    element.getAttribute('aria-hidden') !== 'true' &&
                    element.closest('[inert]') === null,
            )
            if (focusables.length === 0) {
                event.preventDefault()
                panelRef.current?.focus()
                return
            }
            const first = focusables[0]
            const last = focusables[focusables.length - 1]
            if (!panelRef.current?.contains(document.activeElement)) {
                event.preventDefault()
                ;(event.shiftKey ? last : first).focus()
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            cancelAnimationFrame(focusRaf)
            window.removeEventListener('keydown', handleKeyDown)
            const wasTopModal = isTopModal(modalId)
            const stackIndex = openModalStack.lastIndexOf(modalId)
            if (stackIndex >= 0) openModalStack.splice(stackIndex, 1)
            if (openModalStack.length === 0) {
                document.body.style.overflow = bodyOverflowBeforeModal ?? ''
                bodyOverflowBeforeModal = null
            }
            if (wasTopModal && previousFocus?.isConnected) previousFocus.focus()
        }
    }, [initialFocusRef, open])

    if (!open) return null

    return createPortal(
        <div
            className="app-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
                if (
                    event.target === event.currentTarget &&
                    closeOnBackdrop &&
                    !closeDisabled
                )
                    onClose()
            }}
        >
            <div
                ref={panelRef}
                role={role}
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                data-size={size}
                data-tone={tone}
                tabIndex={-1}
                className={`app-modal-panel ${panelClassName}`.trim()}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <span aria-hidden className="app-modal-handle" />
                <header className="app-modal-header" inert={contentInert}>
                    <div className="app-modal-title-wrap">
                        {titleIcon && (
                            <span aria-hidden className="app-modal-title-icon">
                                {titleIcon}
                            </span>
                        )}
                        <div className="app-modal-title-copy">
                            {eyebrow && (
                                <span className="app-modal-eyebrow">
                                    {eyebrow}
                                </span>
                            )}
                            <h2 id={titleId} className="app-modal-title">
                                {title}
                            </h2>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label={closeLabel}
                        disabled={closeDisabled}
                        className="app-modal-close"
                        onClick={onClose}
                    >
                        <TbX aria-hidden />
                    </button>
                </header>
                <div
                    ref={bodyRef}
                    className={`app-modal-body ${bodyClassName}`.trim()}
                    inert={contentInert}
                    onScroll={onBodyScroll}
                >
                    {children}
                </div>
                {(actions?.length || footer) && (
                    <footer
                        className={`app-modal-footer ${footerClassName}`.trim()}
                        inert={contentInert}
                    >
                        {actions?.length ? (
                            <div className="app-modal-actions">
                                {actions.map((action) => (
                                    <AppModalButton
                                        key={action.id}
                                        ref={action.buttonRef}
                                        type={action.type ?? 'button'}
                                        form={action.form}
                                        variant={action.variant ?? 'primary'}
                                        disabled={
                                            action.disabled || action.pending
                                        }
                                        data-autofocus={
                                            action.autoFocus || undefined
                                        }
                                        onClick={() => {
                                            action.onClick?.()
                                            if (action.close) onClose()
                                        }}
                                    >
                                        {action.pending
                                            ? (action.pendingLabel ??
                                              action.label)
                                            : action.label}
                                    </AppModalButton>
                                ))}
                            </div>
                        ) : (
                            footer
                        )}
                    </footer>
                )}
                {overlay}
            </div>
        </div>,
        document.body,
    )
}

export function AppModalActions({ children }: { children: ReactNode }) {
    return <div className="app-modal-actions">{children}</div>
}
