import { useEffect, useRef } from 'react'
import { TbX } from 'react-icons/tb'
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
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
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
        submitError != null ? shopPurchaseErrorViewOf(submitError) : null

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
                aria-labelledby="shopPurchaseTitle"
                className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-content-surface shadow-[var(--shadow-dialog)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <form noValidate onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between border-b border-content-line px-5 py-4">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-brand-structure">
                                고정가 구매
                            </span>
                            <h4
                                id="shopPurchaseTitle"
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
                        <p className="text-sm text-content-muted">
                            아래 금액으로 즉시 구매됩니다. 게임머니가 바로
                            차감되고 아이템은 인벤토리로 들어옵니다.
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
                            취소
                        </button>
                        <button
                            ref={confirmRef}
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-control-action-ink hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? '전송 중…' : '구매 확정'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default ShopPurchaseDialog
