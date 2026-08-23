import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { TbX } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import AppModalButton from '@/components/common/AppModalButton'
import { purchaseErrorViewOf } from '@/features/auction/lib/purchaseErrors'

/**
 * 즉시구매 확인 다이얼로그 (계약 §3.1 · purchase-spec §8) — FC-090.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **BidDialog 와 같은 초점·잠금 규율.** 부모(상세)는 카운트다운으로 **매초 리렌더**된다.
 * ══════════════════════════════════════════════════════════════════════════════
 * 초점·스크롤잠금·키 리스너를 세우는 effect 의 의존은 **`[open]` 뿐**이라 매초 리렌더가 초점을
 * 강탈하지 않는다. `onClose`·`onConfirm` 은 **ref 로 최신값**을 참조해 effect 의존에서 뺀다
 * (인라인 콜백이 매초 새 신원이 돼도 effect 가 안 흔들린다 — FC-064 교훈).
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
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    /**
     * ★★ **초점·스크롤잠금·키보드 — 의존은 `[open]` 뿐이다.**
     * 매초 리렌더가 이 effect 를 흔들지 않는다(콜백은 ref 로 참조).
     */
    useEffect(() => {
        if (!open) return

        previousFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null

        // 스크롤 잠금 — 원래 값을 저장했다가 복원한다(잠금 잔존 방지).
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        // 초점을 확인 버튼으로. 다음 프레임에 넣어 브라우저 초점 이관과 경합하지 않는다.
        const focusRaf = requestAnimationFrame(() =>
            confirmRef.current?.focus(),
        )

        // Escape 닫기 + Tab 초점 가둠.
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
        submitError != null ? purchaseErrorViewOf(submitError) : null

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        onConfirm()
    }

    return createPortal(
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
                aria-labelledby="purchaseDialogTitle"
                className="purchase-entry-dialog w-full max-w-[480px] overflow-hidden rounded-2xl bg-content-surface shadow-[var(--shadow-dialog)]"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <form noValidate onSubmit={handleSubmit}>
                    <div className="legacy-modal-header flex items-center justify-between border-b border-content-line px-5 py-4">
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-brand-structure">
                                즉시구매
                            </span>
                            <h4
                                id="purchaseDialogTitle"
                                className="mt-0.5 text-lg font-bold text-content-fg"
                            >
                                {auctionName}
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
                            아래 금액으로 즉시 낙찰됩니다. 게임머니가 바로
                            차감되고 아이템은 인벤토리로 들어옵니다.
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

                    <div className="legacy-modal-footer flex justify-end gap-2 border-t border-content-line bg-content-soft px-5 py-4">
                        <AppModalButton
                            type="button"
                            variant="secondary"
                            className="px-4 py-2.5"
                            onClick={onClose}
                        >
                            취소
                        </AppModalButton>
                        <AppModalButton
                            ref={confirmRef}
                            type="submit"
                            variant="primary"
                            disabled={isSubmitting}
                            className="px-5 py-2.5"
                        >
                            {isSubmitting ? '전송 중…' : '즉시구매 확정'}
                        </AppModalButton>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    )
}

export default PurchaseDialog
