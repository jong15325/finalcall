import CodeAmount from '@/components/common/CodeAmount'
import AppModal from '@/components/common/AppModal'
import { shopCancelErrorViewOf } from '@/features/shop/lib/shopErrors'

/**
 * 판매 내리기(취소) 확인 다이얼로그 (계약 §3.2 `POST /shops/{id}/cancel` · shop-spec §4.3) — FC-096.
 *
 * ★ 공통 `AppModal`이 초점 이동·스크롤 잠금·Tab 가둠·Escape 닫기와 danger action을 소유한다.
 *   아이템 회수 결과(인벤토리/임시보관)를 함께 안내한다(§4.3).
 * ★ 서버 실패는 `shopCancelErrorViewOf` 로 분기(서버 원문 노출 금지, 계약 §1.4).
 */
interface MyShopCancelDialogProps {
    open: boolean
    onClose: () => void
    itemName: string
    /** 등록가(정수) */
    price: number
    isSubmitting: boolean
    /** 마지막 취소 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onConfirm: () => void
}

function MyShopCancelDialog({
    open,
    onClose,
    itemName,
    price,
    isSubmitting,
    submitError,
    onConfirm,
}: MyShopCancelDialogProps) {
    if (!open) return null

    const errorView =
        submitError != null ? shopCancelErrorViewOf(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <AppModal
            open={open}
            role="alertdialog"
            size="sm"
            tone="danger"
            eyebrow="판매 내리기"
            title={itemName}
            closeDisabled={isSubmitting}
            actions={[
                {
                    id: 'cancel',
                    label: '다시 확인',
                    variant: 'secondary',
                    disabled: isSubmitting,
                    autoFocus: true,
                    onClick: onClose,
                },
                {
                    id: 'confirm',
                    label: '판매 내리기',
                    pendingLabel: '내리는 중…',
                    variant: 'danger',
                    type: 'submit',
                    form: 'shop-cancel-form',
                    pending: isSubmitting,
                },
            ]}
            onClose={onClose}
        >
            <form noValidate id="shop-cancel-form" onSubmit={handleSubmit}>
                <dl className="rounded-lg bg-content-soft p-3.5 text-sm">
                    <div className="flex items-center justify-between">
                        <dt className="text-content-subtle">등록가</dt>
                        <dd>
                            <CodeAmount
                                value={price}
                                mode="full"
                                className="font-semibold text-content-fg"
                            />
                        </dd>
                    </div>
                </dl>

                <ul className="mt-4 flex flex-col gap-1.5 rounded-lg bg-control-action-soft px-4 py-3 text-xs text-control-action-hover">
                    <li>내리면 마켓에서 즉시 사라집니다.</li>
                    <li>
                        아이템은 인벤토리로 돌아갑니다(가득 찬 경우 임시
                        보관함).
                    </li>
                    <li>이미 판매된 상품은 내릴 수 없습니다.</li>
                </ul>

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

export default MyShopCancelDialog
