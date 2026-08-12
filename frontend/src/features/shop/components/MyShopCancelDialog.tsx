import { useEffect, useRef } from 'react'
import { TbX } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import { shopCancelErrorViewOf } from '@/features/shop/lib/shopErrors'

/**
 * 판매 내리기(취소) 확인 다이얼로그 (계약 §3.2 `POST /shops/{id}/cancel` · shop-spec §4.3) — FC-096.
 *
 * ★ **경매·고정가 등록 다이얼로그의 검증된 배선을 그대로 이식**한다(초점 이동·스크롤 잠금·Tab 가둠·
 *   Escape 닫기, 의존 `[open]` 뿐). 취소는 되돌릴 수 있는 안전한 동작이라 파괴적 경고 톤은 쓰지
 *   않고, 아이템 회수 결과(인벤토리/임시보관)만 안내한다(§4.3).
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

        const focusRaf = requestAnimationFrame(() => confirmRef.current?.focus())

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
        submitError != null ? shopCancelErrorViewOf(submitError) : null

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
                aria-labelledby="myShopCancelTitle"
                className="max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-content-surface shadow-[var(--shadow-dialog)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <form noValidate onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between border-b border-content-line px-5 py-4">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-control-action-hover">
                                판매 내리기
                            </span>
                            <h4
                                id="myShopCancelTitle"
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
                            className="rounded-lg bg-danger px-5 py-2.5 text-sm font-bold text-on-strong hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? '내리는 중…' : '판매 내리기'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default MyShopCancelDialog
