import { TbShoppingBag } from 'react-icons/tb'
import AppModal from '@/components/common/AppModal'
import CodeAmount from '@/components/common/CodeAmount'
import { shopPurchaseErrorViewOf } from '@/features/shop/lib/shopErrors'

/**
 * 고정가 구매 확인 다이얼로그 (계약 §3.2 · shop-spec §4.1) — FC-094.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **즉시구매 `PurchaseDialog` 의 검증된 배선을 그대로 이식**한다(초점·스크롤잠금·Tab 가둠).
 * ══════════════════════════════════════════════════════════════════════════════
 * 초점·스크롤잠금·키 리스너 effect 의 의존은 **`[open]` 뿐** — 부모(마켓 목록) 리렌더가 초점을
 * 강탈하지 않는다. `onClose`·`onConfirm` 은 인라인이라 ref 로 최신값을 참조해 의존에서 뺀다.
 *
 * ★ 입력이 없다(금액은 서버가 `shop.price` 로 확정, 요청 본문 없음). 확인만 받는다.
 * ★ **§18 로딩 정책** — 전송 중엔 배경을 블러(오버레이 `backdrop-blur`)하고 확인 버튼을
 *   `disabled`(DOM 속성, 보조기술에 실제 비활성 전달)로 잠근다. `<form noValidate>`.
 * ★ 서버 에러는 `code` 로 분기(`shopErrors`) — 서버 원문 노출 금지.
 */

interface ShopPurchaseDialogProps {
    open: boolean
    onClose: () => void
    /** 구매 대상 아이템 표시명 */
    itemName: string
    /** 고정 판매가(다이얼로그가 열릴 땐 항상 존재) */
    price: number
    /** 사용 가능 게임머니(GET /me/balance). 미확정이면 null */
    gameMoneyAvailable: number | null
    isSubmitting: boolean
    /** 마지막 구매 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onConfirm: () => void
}

function ShopPurchaseDialog({
    open,
    onClose,
    itemName,
    price,
    gameMoneyAvailable,
    isSubmitting,
    submitError,
    onConfirm,
}: ShopPurchaseDialogProps) {
    const errorView =
        submitError != null ? shopPurchaseErrorViewOf(submitError) : null

    return (
        <AppModal
            open={open}
            size="sm"
            eyebrow="고정가 구매"
            title={itemName}
            titleIcon={<TbShoppingBag />}
            onClose={onClose}
            closeDisabled={isSubmitting}
            bodyClassName="shop-purchase-modal-content"
            actions={[
                {
                    id: 'cancel',
                    label: '취소',
                    variant: 'secondary',
                    disabled: isSubmitting,
                    close: true,
                },
                {
                    id: 'confirm',
                    label: '구매 확정',
                    pendingLabel: '전송 중…',
                    variant: 'primary',
                    pending: isSubmitting,
                    autoFocus: true,
                    onClick: onConfirm,
                },
            ]}
        >
            <p className="text-sm leading-relaxed text-content-muted">
                아래 금액으로 즉시 구매됩니다. 게임머니가 바로 차감되고 아이템은
                인벤토리로 들어옵니다.
            </p>

            <div className="my-4 grid gap-1 rounded-xl bg-brand-structure p-5 text-on-strong">
                <span className="text-xs text-on-strong/70">판매가</span>
                <CodeAmount
                    value={price}
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
        </AppModal>
    )
}

export default ShopPurchaseDialog
