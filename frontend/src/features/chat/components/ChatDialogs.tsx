import { useEffect, useId, useRef, useState } from 'react'
import { TbAlertTriangle, TbFlag, TbMessagePlus, TbX } from 'react-icons/tb'
import type { ChatReportReason } from '@/lib/api/chat'

interface DialogBaseProps {
    open: boolean
    pending: boolean
    error: string | null
    onClose: () => void
}

export function NewChatDialog({
    open,
    pending,
    error,
    onClose,
    onSubmit,
}: DialogBaseProps & {
    onSubmit: (counterpartNickname: string) => Promise<boolean>
}) {
    const [counterpartNickname, setCounterpartNickname] = useState('')
    const titleId = useId()
    const dialogRef = useRef<HTMLElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useDialogKeyboard(open, onClose, dialogRef)
    useEffect(() => {
        if (!open) return
        setCounterpartNickname('')
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-brand-structure/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !pending) onClose()
            }}
        >
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md rounded-2xl border border-content-line bg-content-surface p-5 shadow-[var(--shadow-dialog)] sm:p-6"
            >
                <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-control-action-soft text-control-action">
                            <TbMessagePlus aria-hidden className="size-5" />
                        </span>
                        <div>
                            <h2
                                id={titleId}
                                className="text-lg font-bold text-content-fg"
                            >
                                새 대화 시작
                            </h2>
                            <p className="mt-1 text-sm text-content-muted">
                                첫 메시지를 보내기 전까지 상대에게 대화방이
                                표시되지 않습니다.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="새 대화 창 닫기"
                        disabled={pending}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft hover:text-content-fg disabled:opacity-50"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </header>

                <form
                    className="mt-6"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void onSubmit(counterpartNickname).then((succeeded) => {
                            if (succeeded) onClose()
                        })
                    }}
                >
                    <label
                        htmlFor="new-chat-nickname"
                        className="text-sm font-bold text-content-fg"
                    >
                        상대 닉네임
                    </label>
                    <input
                        ref={inputRef}
                        id="new-chat-nickname"
                        value={counterpartNickname}
                        maxLength={30}
                        autoComplete="off"
                        className="mt-2 min-h-11 w-full rounded-lg border border-content-line bg-content-surface px-3 text-base text-content-fg outline-none placeholder:text-content-subtle focus-visible:border-control-action focus-visible:ring-2 focus-visible:ring-control-focus"
                        placeholder="예: 루나상점"
                        aria-describedby={error ? 'new-chat-error' : undefined}
                        onChange={(event) =>
                            setCounterpartNickname(event.target.value)
                        }
                    />
                    {error && (
                        <p
                            id="new-chat-error"
                            role="alert"
                            className="mt-3 text-sm text-danger-ink"
                        >
                            {error}
                        </p>
                    )}
                    <div className="mt-6 flex justify-end gap-2">
                        <button
                            type="button"
                            disabled={pending}
                            className="min-h-11 rounded-lg border border-content-line px-4 text-sm font-bold text-content-fg hover:bg-content-soft disabled:opacity-50"
                            onClick={onClose}
                        >
                            닫기
                        </button>
                        <button
                            type="submit"
                            disabled={
                                pending ||
                                counterpartNickname.trim().length === 0
                            }
                            className="min-h-11 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:opacity-50"
                        >
                            대화 작성
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}

export function ReportChatDialog({
    open,
    pending,
    error,
    counterpartNickname,
    onClose,
    onSubmit,
}: DialogBaseProps & {
    counterpartNickname: string
    onSubmit: (reason: ChatReportReason, detail?: string) => Promise<boolean>
}) {
    const [reason, setReason] = useState<ChatReportReason>('SPAM')
    const [detail, setDetail] = useState('')
    const titleId = useId()
    const dialogRef = useRef<HTMLElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)

    useDialogKeyboard(open, onClose, dialogRef)
    useEffect(() => {
        if (!open) return
        setReason('SPAM')
        setDetail('')
        requestAnimationFrame(() => selectRef.current?.focus())
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-brand-structure/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !pending) onClose()
            }}
        >
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-lg rounded-2xl border border-content-line bg-content-surface p-5 shadow-[var(--shadow-dialog)] sm:p-6"
            >
                <header className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger-ink">
                            <TbFlag aria-hidden className="size-5" />
                        </span>
                        <div>
                            <h2
                                id={titleId}
                                className="text-lg font-bold text-content-fg"
                            >
                                메시지 신고
                            </h2>
                            <p className="mt-1 text-sm text-content-muted">
                                {counterpartNickname}님의 메시지를 신고합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="신고 창 닫기"
                        disabled={pending}
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-content-muted hover:bg-content-soft hover:text-content-fg disabled:opacity-50"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </header>

                <form
                    className="mt-6 space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void onSubmit(reason, detail).then((succeeded) => {
                            if (succeeded) onClose()
                        })
                    }}
                >
                    <div>
                        <label
                            htmlFor="chat-report-reason"
                            className="text-sm font-bold text-content-fg"
                        >
                            신고 사유
                        </label>
                        <select
                            ref={selectRef}
                            id="chat-report-reason"
                            value={reason}
                            className="mt-2 min-h-11 w-full rounded-lg border border-content-line bg-content-surface px-3 text-base text-content-fg outline-none focus-visible:border-control-action focus-visible:ring-2 focus-visible:ring-control-focus"
                            onChange={(event) =>
                                setReason(
                                    event.target.value as ChatReportReason,
                                )
                            }
                        >
                            <option value="SPAM">스팸·반복 메시지</option>
                            <option value="ABUSE">욕설·괴롭힘</option>
                            <option value="FRAUD">사기·외부 송금 요구</option>
                            <option value="OTHER">기타</option>
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="chat-report-detail"
                            className="text-sm font-bold text-content-fg"
                        >
                            상세 내용{' '}
                            <span className="font-normal">(선택)</span>
                        </label>
                        <textarea
                            id="chat-report-detail"
                            rows={4}
                            value={detail}
                            maxLength={500}
                            className="mt-2 w-full resize-y rounded-lg border border-content-line bg-content-surface px-3 py-2 text-base leading-6 text-content-fg outline-none placeholder:text-content-subtle focus-visible:border-control-action focus-visible:ring-2 focus-visible:ring-control-focus"
                            placeholder="신고 검토에 필요한 상황만 적어 주세요."
                            onChange={(event) => setDetail(event.target.value)}
                        />
                        <p className="mt-1 text-right text-xs text-content-subtle tabular-nums">
                            {detail.length}/500
                        </p>
                    </div>
                    <p className="flex gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm text-warning">
                        <TbAlertTriangle
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0"
                        />
                        토큰, 비밀번호, 인증 코드 등 민감정보는 적지 마세요.
                    </p>
                    {error && (
                        <p role="alert" className="text-sm text-danger-ink">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            disabled={pending}
                            className="min-h-11 rounded-lg border border-content-line px-4 text-sm font-bold text-content-fg hover:bg-content-soft disabled:opacity-50"
                            onClick={onClose}
                        >
                            신고하지 않기
                        </button>
                        <button
                            type="submit"
                            disabled={pending}
                            className="min-h-11 rounded-lg bg-danger px-4 text-sm font-bold text-control-action-ink hover:brightness-95 disabled:opacity-50"
                        >
                            {pending ? '신고 접수 중…' : '메시지 신고'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    )
}

function useDialogKeyboard(
    open: boolean,
    onClose: () => void,
    dialogRef: React.RefObject<HTMLElement | null>,
) {
    useEffect(() => {
        if (!open) return
        const previousFocus =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
                return
            }
            if (event.key !== 'Tab') return

            const focusable = [
                ...(dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
                ) ?? []),
            ]
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable.at(-1)!
            const active = document.activeElement
            if (!dialogRef.current?.contains(active)) {
                event.preventDefault()
                first.focus()
            } else if (event.shiftKey && active === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            previousFocus?.focus()
        }
    }, [dialogRef, onClose, open])
}
