import { useEffect, useRef, useState } from 'react'
import { TbAlertTriangle, TbX } from 'react-icons/tb'
import { withdrawErrorMessage } from '@/features/member/lib/memberErrors'

/**
 * 회원 탈퇴 확인 다이얼로그 (FC-074 — 목업 `#withdrawDialog` · design-brief B-7 · D-080).
 *
 * ★ **BidDialog(FC-072) 패턴 승계** — 초점·스크롤잠금·Escape·Tab 가둠 effect 의존은 `[open]` 뿐.
 * ★ **명시 동의 필수**(D-080): 잔액 소멸·복구 불가·모든 세션 폐기를 경고하고, 체크박스 동의 전에는
 *   확정 버튼을 **DOM `disabled`** 로 막는다(색만 X — 보조기술에 실제 비활성 전달).
 * ★ 서버 에러는 code 로 문구(`MEMBER_002` 진행 중 거래 → 문구, 원문 미노출).
 */

interface WithdrawDialogProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    isSubmitting: boolean
    /** 마지막 탈퇴 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
}

function WithdrawDialog({
    open,
    onClose,
    onConfirm,
    isSubmitting,
    submitError,
}: WithdrawDialogProps) {
    const [acknowledged, setAcknowledged] = useState(false)

    const dialogRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // 초점·스크롤잠금·키보드 — 의존은 [open] 뿐(BidDialog 와 동일 구조).
    useEffect(() => {
        if (!open) return

        setAcknowledged(false)

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() =>
            dialogRef.current
                ?.querySelector<HTMLElement>('input, button')
                ?.focus(),
        )

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab') return

            const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )
            if (!focusables || focusables.length === 0) return

            const list = Array.from(focusables).filter(
                (el) => !el.hasAttribute('disabled'),
            )
            const first = list[0]
            const last = list[list.length - 1]
            const active = document.activeElement

            if (event.shiftKey && active === first) {
                event.preventDefault()
                last?.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first?.focus()
            }
        }
        document.addEventListener('keydown', onKeyDown)

        return () => {
            cancelAnimationFrame(focusRaf)
            document.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
            previousFocusRef.current?.focus()
        }
    }, [open])

    if (!open) return null

    const errorMessage =
        submitError != null ? withdrawErrorMessage(submitError) : null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-chrome-strong/60 px-4 backdrop-blur-[2px]"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="withdrawDialogTitle"
                className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-content-surface shadow-[var(--shadow-dialog)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-content-line px-5 py-4">
                    <div className="flex items-center gap-2">
                        <TbAlertTriangle
                            aria-hidden
                            className="size-5 text-danger-ink"
                        />
                        <h4
                            id="withdrawDialogTitle"
                            className="text-lg font-bold text-content-fg"
                        >
                            정말 탈퇴하시겠습니까?
                        </h4>
                    </div>
                    <button
                        type="button"
                        aria-label="닫기"
                        className="flex size-8 items-center justify-center rounded-lg text-content-subtle hover:bg-content-soft hover:text-content-fg"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>

                <div className="px-5 py-5">
                    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-content-muted">
                        <li>
                            남은 게임머니·캐시 잔액이 <strong>모두 소멸</strong>
                            하며 복구할 수 없습니다.
                        </li>
                        <li>
                            로그인 세션이 전부 폐기되고 계정 정보는 되돌릴 수
                            없습니다.
                        </li>
                        <li>진행 중인 거래가 있으면 탈퇴할 수 없습니다.</li>
                    </ul>

                    <label className="mt-4 flex items-start gap-2.5 rounded-lg bg-content-soft px-3.5 py-3 text-sm text-content-fg">
                        <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
                            checked={acknowledged}
                            onChange={(event) =>
                                setAcknowledged(event.target.checked)
                            }
                        />
                        <span>
                            잔액 소멸과 복구 불가에 동의하며, 탈퇴를 진행합니다.
                        </span>
                    </label>

                    {errorMessage && (
                        <p
                            role="alert"
                            className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                        >
                            {errorMessage}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-2 border-t border-content-line bg-content-soft px-5 py-4">
                    <button
                        type="button"
                        className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:bg-content-soft"
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={!acknowledged || isSubmitting}
                        className="rounded-lg bg-danger px-5 py-2.5 text-sm font-bold text-on-strong hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={onConfirm}
                    >
                        {isSubmitting ? '처리 중…' : '탈퇴 확정'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default WithdrawDialog
