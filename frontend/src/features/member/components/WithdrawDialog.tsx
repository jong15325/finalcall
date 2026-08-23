import { useEffect, useRef, useState } from 'react'
import { TbAlertTriangle } from 'react-icons/tb'
import AppModal from '@/components/common/AppModal'
import { withdrawErrorMessage } from '@/features/member/lib/memberErrors'

/**
 * 회원 탈퇴 확인 다이얼로그 (FC-074 — 목업 `#withdrawDialog` · design-brief B-7 · D-080).
 *
 * ★ 공통 `AppModal`이 초점·스크롤잠금·Escape·Tab 가둠과 danger action을 소유한다.
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

    const acknowledgmentRef = useRef<HTMLInputElement>(null)

    // 새로 열 때마다 명시 동의 상태만 초기화한다.
    useEffect(() => {
        if (!open) return

        setAcknowledged(false)
    }, [open])

    if (!open) return null

    const errorMessage =
        submitError != null ? withdrawErrorMessage(submitError) : null

    return (
        <AppModal
            open={open}
            role="alertdialog"
            size="md"
            tone="danger"
            title="정말 탈퇴하시겠습니까?"
            titleIcon={<TbAlertTriangle />}
            closeDisabled={isSubmitting}
            initialFocusRef={acknowledgmentRef}
            actions={[
                {
                    id: 'cancel',
                    label: '취소',
                    variant: 'secondary',
                    disabled: isSubmitting,
                    onClick: onClose,
                },
                {
                    id: 'confirm',
                    label: '탈퇴 확정',
                    pendingLabel: '처리 중…',
                    variant: 'danger',
                    disabled: !acknowledged,
                    pending: isSubmitting,
                    onClick: onConfirm,
                },
            ]}
            onClose={onClose}
        >
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-content-muted">
                <li>
                    남은 게임머니·캐시 잔액이 <strong>모두 소멸</strong>
                    하며 복구할 수 없습니다.
                </li>
                <li>
                    로그인 세션이 전부 폐기되고 계정 정보는 되돌릴 수 없습니다.
                </li>
                <li>진행 중인 거래가 있으면 탈퇴할 수 없습니다.</li>
            </ul>

            <label className="mt-4 flex items-start gap-2.5 rounded-lg bg-content-soft px-3.5 py-3 text-sm text-content-fg">
                <input
                    ref={acknowledgmentRef}
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-[var(--danger)]"
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
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
        </AppModal>
    )
}

export default WithdrawDialog
