import { useEffect, useMemo, useRef, useState } from 'react'
import { TbPencil, TbX } from 'react-icons/tb'
import GamePreview from './GamePreview'
import { sendMemoErrorMessage } from '@/features/memo/lib/memoErrors'
import {
    getStringByte,
    MEMO_MAX_BYTES,
    MEMO_NEAR_BYTES,
} from '@/features/memo/lib/memoBytes'
import type { SendMemoRequest } from '@/lib/api/memos'

/**
 * 쪽지 쓰기 다이얼로그 (FC-172 · 안 A 확정) — 자유 텍스트 단일 입력 + 실시간 28바이트 미리보기.
 *
 * ★ **WithdrawDialog(FC-074) a11y 패턴 승계** — 초점·스크롤잠금·Escape·Tab 가둠, 의존은 `[open]`.
 * ★ 본문은 **수동 개행 없이** 자유 입력하며(게이트2 (d)), 게임 표시용 28바이트 줄바꿈은 미리보기가
 *   실시간으로 보여준다. 용량 카운터(≤112바이트, `getStringByte`)로 상한을 알린다 — 초과·빈값·
 *   수신자 미입력이면 보내기를 **DOM `disabled`** 로 막는다(색만 X, WCAG 4.1.2).
 * ★ 서버 에러는 code 로 문구(`MEMO_001` 수신자 없음·`MEMO_004` 자기 발신, 원문 미노출).
 */
interface MemoComposeDialogProps {
    open: boolean
    /** 답장 시 수신자 프리필(없으면 빈 값에서 시작) */
    prefillTo?: string
    onClose: () => void
    onSubmit: (request: SendMemoRequest) => void
    isSubmitting: boolean
    /** 마지막 발신 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
}

/** 수신자 닉네임 최대 길이(계약 §2.6 `≤16`). */
const RECEIVER_MAX = 16

function MemoComposeDialog({
    open,
    prefillTo,
    onClose,
    onSubmit,
    isSubmitting,
    submitError,
}: MemoComposeDialogProps) {
    const [receiver, setReceiver] = useState('')
    const [body, setBody] = useState('')

    const dialogRef = useRef<HTMLDivElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    // 초점·스크롤잠금·키보드 — 의존은 [open] 뿐(WithdrawDialog 와 동일 구조).
    useEffect(() => {
        if (!open) return

        setReceiver(prefillTo ?? '')
        setBody('')

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() =>
            dialogRef.current
                ?.querySelector<HTMLElement>('input, textarea, button')
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
    }, [open, prefillTo])

    const bytes = useMemo(() => getStringByte(body), [body])
    const overLimit = bytes > MEMO_MAX_BYTES
    const near = bytes > MEMO_NEAR_BYTES && !overLimit
    const canSend =
        receiver.trim().length > 0 &&
        body.trim().length > 0 &&
        !overLimit &&
        !isSubmitting

    if (!open) return null

    const errorMessage =
        submitError != null ? sendMemoErrorMessage(submitError) : null

    const handleSend = () => {
        if (!canSend) return
        onSubmit({ receiverNickname: receiver.trim(), body })
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-chrome-strong/60 px-0 backdrop-blur-[2px] sm:items-center sm:px-4"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="memoComposeTitle"
                className="flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-2xl bg-content-surface shadow-[var(--shadow-dialog)] sm:rounded-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex flex-none items-center justify-between border-b border-content-line px-5 py-4">
                    <h4
                        id="memoComposeTitle"
                        className="flex items-center gap-2 text-lg font-bold text-content-fg"
                    >
                        <TbPencil aria-hidden className="size-5 text-brand-structure" />
                        쪽지 쓰기
                    </h4>
                    <button
                        type="button"
                        aria-label="닫기"
                        className="flex size-8 items-center justify-center rounded-lg text-content-subtle hover:bg-content-soft hover:text-content-fg"
                        onClick={onClose}
                    >
                        <TbX aria-hidden className="size-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    {/* 받는 사람 */}
                    <div>
                        <label
                            htmlFor="memo-receiver"
                            className="mb-1.5 block text-sm font-bold text-content-fg"
                        >
                            받는 사람
                            <span className="ml-0.5 text-danger-ink">*</span>
                        </label>
                        <input
                            id="memo-receiver"
                            type="text"
                            value={receiver}
                            maxLength={RECEIVER_MAX}
                            placeholder="닉네임 입력 (최대 16자)"
                            autoComplete="off"
                            className="h-11 w-full rounded-lg border border-content-line bg-content-surface px-3 text-sm text-content-fg outline-none focus:border-control-action focus:ring-2 focus:ring-control-action/30"
                            onChange={(event) =>
                                setReceiver(event.target.value)
                            }
                        />
                        <p className="mt-1.5 text-xs text-content-subtle">
                            활성 회원의 닉네임을 입력하세요. 없는 닉네임이면
                            보낼 수 없습니다.
                        </p>
                    </div>

                    {/* 내용 */}
                    <div>
                        <label
                            htmlFor="memo-body"
                            className="mb-1.5 block text-sm font-bold text-content-fg"
                        >
                            내용
                            <span className="ml-0.5 text-danger-ink">*</span>
                        </label>
                        <textarea
                            id="memo-body"
                            value={body}
                            placeholder="자유롭게 입력하세요. 줄바꿈은 게임에서 자동으로 처리됩니다."
                            rows={4}
                            className={`min-h-28 w-full resize-y rounded-lg border bg-content-surface px-3 py-2.5 text-sm leading-relaxed text-content-fg outline-none break-keep focus:ring-2 ${
                                overLimit
                                    ? 'border-danger focus:border-danger focus:ring-danger/30'
                                    : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                            }`}
                            onChange={(event) => setBody(event.target.value)}
                        />
                        <div className="mt-1.5 flex items-center justify-between text-xs text-content-subtle">
                            <span>게임 표시 용량</span>
                            <span aria-live="polite">
                                <b
                                    className={`font-bold tabular-nums ${
                                        overLimit
                                            ? 'text-danger-ink'
                                            : near
                                              ? 'text-warning'
                                              : 'text-content-muted'
                                    }`}
                                >
                                    {bytes}
                                </b>{' '}
                                / {MEMO_MAX_BYTES}바이트
                            </span>
                        </div>
                        {overLimit && (
                            <p
                                role="alert"
                                className="mt-1 text-xs font-semibold text-danger-ink"
                            >
                                내용이 게임 표시 한도(112바이트)를 넘었습니다.
                                줄여 주세요.
                            </p>
                        )}
                    </div>

                    {/* 실시간 게임 미리보기 */}
                    <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-content-subtle">
                            게임에서 이렇게 보여요 (실시간)
                        </p>
                        <GamePreview
                            showRuler
                            body={body}
                            title="게임 쪽지 미리보기 · 28바이트 폭"
                            caption="입력하는 대로 28바이트마다 줄이 나뉩니다(한글 2·영문숫자 1바이트)."
                        />
                    </div>

                    {errorMessage && (
                        <p
                            role="alert"
                            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                        >
                            {errorMessage}
                        </p>
                    )}
                </div>

                <div className="flex flex-none justify-end gap-2 border-t border-content-line bg-content-soft px-5 py-4">
                    <button
                        type="button"
                        className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:bg-content-soft"
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        disabled={!canSend}
                        className="rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={handleSend}
                    >
                        {isSubmitting ? '보내는 중…' : '보내기'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MemoComposeDialog
