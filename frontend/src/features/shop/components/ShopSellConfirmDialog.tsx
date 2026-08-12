import { useEffect, useRef } from 'react'
import { TbX } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import SellFeeEstimate from '@/features/auction/components/SellFeeEstimate'
import { createShopErrorViewOf } from '@/features/shop/lib/shopErrors'

/**
 * 고정가 등록 확인 다이얼로그 (계약 §3.2 · shop-spec §3) — FC-094.
 *
 * ★ **경매 등록 `SellConfirmDialog` 의 검증된 배선을 그대로 이식**한다(초점·스크롤잠금·Tab 가둠,
 *   의존 `[open]` 뿐). 경매 대비 훨씬 짧다 — 시작가·즉시구매가·시간 파라미터가 없고 **판매가 하나**다.
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
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!open) return

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusRaf = requestAnimationFrame(() =>
            confirmRef.current?.focus(),
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

    const errorView =
        submitError != null ? createShopErrorViewOf(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

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
                aria-labelledby="shopSellConfirmTitle"
                className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-content-surface shadow-[var(--shadow-dialog)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <form noValidate onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between border-b border-content-line px-5 py-4">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-control-action-hover">
                                등록 확인
                            </span>
                            <h4
                                id="shopSellConfirmTitle"
                                className="mt-0.5 text-lg font-bold text-content-fg"
                            >
                                {itemName}
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

                        <SellFeeEstimate startPrice={price} />

                        <ul className="mt-4 flex flex-col gap-1.5 rounded-lg bg-control-action-soft px-4 py-3 text-xs text-control-action-hover">
                            <li>등록 즉시 마켓에 고정가로 노출됩니다.</li>
                            <li>판매되기 전에는 언제든 취소할 수 있습니다.</li>
                            <li>
                                판매 기간이 지나면 자동으로 내려가 임시
                                보관함으로 돌아갑니다.
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
                    </div>

                    <div className="flex justify-end gap-2 border-t border-content-line bg-content-soft px-5 py-4">
                        <button
                            type="button"
                            className="rounded-lg border border-content-line bg-content-surface px-4 py-2.5 text-sm font-bold text-content-muted hover:bg-content-soft"
                            onClick={onClose}
                        >
                            다시 확인
                        </button>
                        <button
                            ref={confirmRef}
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-on-strong hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? '등록 중…' : '고정가 등록 확정'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ShopSellConfirmDialog
