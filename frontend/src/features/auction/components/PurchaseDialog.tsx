import { useRef } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import AppModal from '@/components/common/AppModal'
import { purchaseErrorViewOf } from '@/features/auction/lib/purchaseErrors'

/**
 * 즉시구매 확인 다이얼로그 (계약 §3.1 · purchase-spec §8) — FC-090.
 *
 * ★ 공통 `AppModal`이 초점·스크롤 잠금·Escape·Tab 가둠을 소유한다. 부모(상세)가
 * 카운트다운으로 매초 리렌더돼도 셸의 open 기반 생명주기는 다시 세워지지 않는다.
 *
 * ★ 입력이 없다(금액은 서버가 `buyNowPrice` 로 확정, 요청 본문 없음). 확인만 받는다.
 * ★ 전송중 확인 버튼 `disabled` 는 **DOM 속성**(보조기술에 실제 비활성 전달). `<form noValidate>`.
 * ★ 서버 에러는 `code` 로 분기(`purchaseErrors`) — 서버 원문 노출 금지.
 */

interface PurchaseDialogProps {
    open: boolean
    onClose: () => void
    auctionName: string
    /** 즉시구매가(다이얼로그가 열릴 땐 항상 존재) */
    buyNowPrice: number
    /** 사용 가능 게임머니(GET /me/balance). 미확정이면 null */
    gameMoneyAvailable: number | null
    isSubmitting: boolean
    /** 마지막 즉시구매 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onConfirm: () => void
}

function PurchaseDialog({
    open,
    onClose,
    auctionName,
    buyNowPrice,
    gameMoneyAvailable,
    isSubmitting,
    submitError,
    onConfirm,
}: PurchaseDialogProps) {
    const confirmRef = useRef<HTMLButtonElement>(null)

    if (!open) return null

    const errorView =
        submitError != null ? purchaseErrorViewOf(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <AppModal
            open={open}
            size="md"
            eyebrow="즉시구매"
            title={auctionName}
            closeDisabled={isSubmitting}
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
                    label: '즉시구매 확정',
                    pendingLabel: '전송 중…',
                    variant: 'primary',
                    type: 'submit',
                    form: 'auction-purchase-form',
                    pending: isSubmitting,
                    autoFocus: true,
                    buttonRef: confirmRef,
                },
            ]}
            onClose={onClose}
        >
            <form noValidate id="auction-purchase-form" onSubmit={handleSubmit}>
                <p className="text-sm text-content-muted">
                    아래 금액으로 즉시 낙찰됩니다. 게임머니가 바로 차감되고
                    아이템은 인벤토리로 들어옵니다.
                </p>

                <div className="my-4 grid gap-1 rounded-xl bg-brand-structure p-5 text-on-strong">
                    <span className="text-xs text-on-strong/70">
                        즉시구매가
                    </span>
                    <CodeAmount
                        value={buyNowPrice}
                        mode="full"
                        className="text-2xl font-bold"
                    />
                </div>

                <p className="flex items-center justify-between gap-1.5 text-sm text-content-muted">
                    <span>구매 후 사용 가능 잔액</span>
                    <CodeAmount
                        value={gameMoneyAvailable}
                        mode="full"
                        className="font-bold text-content-fg"
                    />
                </p>

                {/* 서버 응답 실패 — code 로 분기(purchaseErrors) */}
                {errorView && (
                    <div
                        role="alert"
                        className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                    >
                        <strong className="font-bold">{errorView.title}</strong>
                        {errorView.description && (
                            <span className="mt-0.5 block text-danger-ink/90">
                                {errorView.description}
                            </span>
                        )}
                    </div>
                )}
            </form>
        </AppModal>
    )
}

export default PurchaseDialog
