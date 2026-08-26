import { useEffect, useRef, useState } from 'react'
import { TbAlertTriangle, TbFlag, TbMessagePlus } from 'react-icons/tb'
import AppModal from '@/components/common/AppModal'
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

    useEffect(() => {
        if (!open) return
        setCounterpartNickname('')
    }, [open])

    if (!open) return null

    return (
        <AppModal
            open={open}
            size="md"
            title="새 대화 시작"
            titleIcon={<TbMessagePlus />}
            descriptionId="new-chat-description"
            closeDisabled={pending}
            closeLabel="새 대화 창 닫기"
            actions={[
                {
                    id: 'cancel',
                    label: '닫기',
                    variant: 'secondary',
                    disabled: pending,
                    onClick: onClose,
                },
                {
                    id: 'submit',
                    label: '대화 작성',
                    pendingLabel: '작성 중…',
                    variant: 'primary',
                    type: 'submit',
                    form: 'new-chat-form',
                    disabled: counterpartNickname.trim().length === 0,
                    pending,
                },
            ]}
            onClose={onClose}
        >
            <p id="new-chat-description" className="text-sm text-content-muted">
                첫 메시지를 보내기 전까지 상대에게 대화방이 표시되지 않습니다.
            </p>
            <form
                id="new-chat-form"
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
            </form>
        </AppModal>
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
    const selectRef = useRef<HTMLSelectElement>(null)

    useEffect(() => {
        if (!open) return
        setReason('SPAM')
        setDetail('')
        requestAnimationFrame(() => selectRef.current?.focus())
    }, [open])

    if (!open) return null

    return (
        <AppModal
            open={open}
            size="md"
            tone="danger"
            title="메시지 신고"
            titleIcon={<TbFlag />}
            descriptionId="chat-report-description"
            closeDisabled={pending}
            closeLabel="신고 창 닫기"
            initialFocusRef={selectRef}
            actions={[
                {
                    id: 'cancel',
                    label: '신고하지 않기',
                    variant: 'secondary',
                    disabled: pending,
                    autoFocus: true,
                    onClick: onClose,
                },
                {
                    id: 'submit',
                    label: '메시지 신고',
                    pendingLabel: '신고 접수 중…',
                    variant: 'danger',
                    type: 'submit',
                    form: 'chat-report-form',
                    pending,
                },
            ]}
            onClose={onClose}
        >
            <p
                id="chat-report-description"
                className="text-sm text-content-muted"
            >
                {counterpartNickname}님의 메시지를 신고합니다.
            </p>
            <form
                id="chat-report-form"
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
                            setReason(event.target.value as ChatReportReason)
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
                        상세 내용 <span className="font-normal">(선택)</span>
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
            </form>
        </AppModal>
    )
}
