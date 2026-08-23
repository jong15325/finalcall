import { useEffect, useMemo, useState } from 'react'
import { TbPencil } from 'react-icons/tb'
import AppModal from '@/components/common/AppModal'
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

    useEffect(() => {
        if (!open) return
        setReceiver(prefillTo ?? '')
        setBody('')
    }, [open, prefillTo])

    const bytes = useMemo(() => getStringByte(body), [body])
    const overLimit = bytes > MEMO_MAX_BYTES
    const near = bytes > MEMO_NEAR_BYTES && !overLimit
    const canSend =
        receiver.trim().length > 0 &&
        body.trim().length > 0 &&
        !overLimit &&
        !isSubmitting

    const errorMessage =
        submitError != null ? sendMemoErrorMessage(submitError) : null

    const handleSend = () => {
        if (!canSend) return
        onSubmit({ receiverNickname: receiver.trim(), body })
    }

    return (
        <AppModal
            open={open}
            title="쪽지 쓰기"
            titleIcon={<TbPencil />}
            size="md"
            onClose={onClose}
            panelClassName="memo-compose-dialog"
            bodyClassName="memo-compose-body space-y-5"
            actions={[
                {
                    id: 'send',
                    label: '보내기',
                    pendingLabel: '보내는 중…',
                    variant: 'primary',
                    disabled: !canSend,
                    pending: isSubmitting,
                    autoFocus: false,
                    onClick: handleSend,
                },
            ]}
            footerClassName="memo-compose-footer flex justify-end"
        >
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
                    onChange={(event) => setReceiver(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-content-subtle">
                    활성 회원의 닉네임을 입력하세요. 없는 닉네임이면 보낼 수
                    없습니다.
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
                    rows={6}
                    wrap="soft"
                    className={`h-36 min-h-36 max-h-36 w-full resize-none overflow-y-auto whitespace-pre-wrap rounded-lg border bg-content-surface px-3 py-2.5 text-sm leading-relaxed break-words text-content-fg outline-none focus:ring-2 ${
                        overLimit
                            ? 'border-danger focus:border-danger focus:ring-danger/30'
                            : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                    }`}
                    onChange={(event) => setBody(event.target.value)}
                />
                <div className="mt-1.5 flex items-center justify-end text-xs text-content-subtle">
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
                        내용이 게임 표시 한도(112바이트)를 넘었습니다. 줄여
                        주세요.
                    </p>
                )}
            </div>

            {errorMessage && (
                <p
                    role="alert"
                    className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                >
                    {errorMessage}
                </p>
            )}
        </AppModal>
    )
}

export default MemoComposeDialog
