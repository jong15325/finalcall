import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import AppModal from '@/components/common/AppModal'
import SellFeeEstimate from '@/features/auction/components/SellFeeEstimate'
import { createShopErrorViewOf } from '@/features/shop/lib/shopErrors'
import useDesktopLayout from '@/components/layout/useDesktopLayout'

/**
 * 고정가 등록 확인 다이얼로그 (계약 §3.2 · shop-spec §3) — FC-094.
 *
 * ★ 경매 등록 `SellConfirmDialog`와 같은 공통 `AppModal` 셸과 action 버튼을 사용한다.
 *   경매 대비 훨씬 짧다 — 시작가·즉시구매가·시간 파라미터가 없고 **판매가 하나**다.
 * ★ **판매 기한은 표시하지 않는다** — 판매자가 고르지 않고 서버가 설정 일수로 자동 계산하기
 *   때문이다(shop-spec §3.1). 대신 "기간이 지나면 임시보관함으로 돌아간다"(만료 회수, §4.4)와
 *   "판매 전 취소 가능"(§4.3)을 안내한다. 일수를 하드코딩하지 않는다(관리자 설정값).
 * ★ 수수료는 **예상**만(fee-policy-spec, 정산 시 서버 확정) — `SellFeeEstimate` 재사용.
 * ★ 서버 실패는 `createShopErrorViewOf` 로 분기(서버 원문 노출 금지).
 */
interface ShopSellConfirmDialogProps {
    open: boolean
    onClose: () => void
    itemName: string
    /** 고정 판매가(정수) */
    price: number
    isSubmitting: boolean
    /** 마지막 등록 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onConfirm: () => void
}

function ShopSellConfirmDialog({
    open,
    onClose,
    itemName,
    price,
    isSubmitting,
    submitError,
    onConfirm,
}: ShopSellConfirmDialogProps) {
    const confirmRef = useRef<HTMLButtonElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const desktop = useDesktopLayout()
    const [reviewed, setReviewed] = useState(desktop)

    useLayoutEffect(() => {
        if (!open || desktop) {
            setReviewed(desktop)
            return
        }

        const scroll = scrollRef.current
        if (!scroll) return
        const measure = () =>
            setReviewed(
                scroll.scrollHeight - scroll.scrollTop <=
                    scroll.clientHeight + 1,
            )
        measure()
        window.addEventListener('resize', measure)
        const observer =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(measure)
        observer?.observe(scroll)
        const mutationObserver = new MutationObserver(measure)
        mutationObserver.observe(scroll, {
            childList: true,
            subtree: true,
            characterData: true,
        })
        return () => {
            window.removeEventListener('resize', measure)
            observer?.disconnect()
            mutationObserver.disconnect()
        }
    }, [desktop, open, submitError])

    useEffect(() => {
        if (!open) return
        const confirm = confirmRef.current
        if (reviewed && confirm && !confirm.disabled) {
            confirm.focus()
        }
    }, [desktop, isSubmitting, open, reviewed])

    if (!open) return null

    const errorView =
        submitError != null ? createShopErrorViewOf(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return (
        <AppModal
            open={open}
            size="md"
            eyebrow="등록 확인"
            title={itemName}
            closeDisabled={isSubmitting}
            bodyClassName="ci-scroll"
            bodyRef={scrollRef}
            actions={[
                {
                    id: 'review',
                    label: '다시 확인',
                    variant: 'secondary',
                    disabled: isSubmitting,
                    onClick: onClose,
                },
                {
                    id: 'confirm',
                    label: '판매 등록',
                    pendingLabel: '등록 중…',
                    variant: 'primary',
                    type: 'submit',
                    form: 'shop-sell-confirm-form',
                    disabled: !desktop && !reviewed,
                    pending: isSubmitting,
                    autoFocus: reviewed,
                    buttonRef: confirmRef,
                },
            ]}
            onBodyScroll={() => {
                const scroll = scrollRef.current
                if (
                    scroll &&
                    scroll.scrollHeight - scroll.scrollTop <=
                        scroll.clientHeight + 1
                ) {
                    setReviewed(true)
                }
            }}
            onClose={onClose}
        >
            <form
                noValidate
                id="shop-sell-confirm-form"
                onSubmit={handleSubmit}
            >
                <div className="min-h-0">
                    <dl className="rounded-lg bg-content-soft p-3.5 text-sm">
                        <div className="flex items-center justify-between">
                            <dt className="text-content-subtle">판매 방식</dt>
                            <dd className="font-semibold text-content-fg">
                                고정가
                            </dd>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <dt className="text-content-subtle">판매가</dt>
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
                        <li>등록 즉시 마켓에 고정가로 노출됩니다.</li>
                        <li>판매되기 전에는 언제든 취소할 수 있습니다.</li>
                        <li>
                            판매 기간이 지나면 자동으로 내려가 임시 보관함으로
                            돌아갑니다.
                        </li>
                    </ul>

                    {errorView && (
                        <div
                            role="alert"
                            className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                        >
                            <strong className="font-bold">
                                {errorView.title}
                            </strong>
                            {errorView.description && (
                                <span className="mt-0.5 block text-danger-ink/90">
                                    {errorView.description}
                                </span>
                            )}
                        </div>
                    )}

                    <SellFeeEstimate startPrice={price} />
                </div>
            </form>
        </AppModal>
    )
}

export default ShopSellConfirmDialog
