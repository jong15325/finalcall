import { useEffect, useRef } from 'react'
import { TbX } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import SellFeeEstimate from './SellFeeEstimate'
import { createAuctionErrorViewOf } from '@/features/auction/lib/sellErrors'

/**
 * 경매 등록 확인 다이얼로그 (FC-073 — FC-072 `BidDialog` 배선 패턴 이식).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **BidDialog 의 검증된 다이얼로그 배선을 그대로 가져온다.**
 * ══════════════════════════════════════════════════════════════════════════════
 *  - 초점·스크롤잠금·Escape·Tab 가둠 effect 의존은 **`[open]` 뿐** — 부모 리렌더가 초점을
 *    강탈하지 않는다. 콜백(`onClose`)은 **ref 로 최신값 참조**해 의존에서 뺀다.
 *  - `<form noValidate>`(브라우저 말풍선·커스텀 검증 이중 표시 방지).
 *  - 전송중 확정 버튼 `disabled` 는 **DOM 속성**(보조기술에 실제 비활성 전달).
 *
 * ★ 이 화면은 등록 **직전 최종 확인**이다 — 시작가·즉시구매가·수수료 예상·경고를 한 번 더 보이고
 *   확정 시 `POST /auctions`. 등록 후 가격 변경 불가·연장 가능성을 명시한다(design-brief B-12).
 * ★ 서버 실패는 `createAuctionErrorViewOf` 로 분기(서버 원문 노출 금지).
 */
interface SellConfirmDialogProps {
    open: boolean
    onClose: () => void
    itemName: string
    startPrice: number
    buyNowPrice: number | null
    /** 마감 시각(표시용 로컬 문자열 — 사용자가 입력한 값 그대로 사람이 읽는 표기) */
    endAtLabel: string
    maxEndAtLabel: string
    isSubmitting: boolean
    /** 마지막 등록 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onConfirm: () => void
}

function SellConfirmDialog({
    open,
    onClose,
    itemName,
    startPrice,
    buyNowPrice,
    endAtLabel,
    maxEndAtLabel,
    isSubmitting,
    submitError,
    onConfirm,
}: SellConfirmDialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    const previousFocusRef = useRef<HTMLElement | null>(null)
    /** 최신 onClose — effect 의존에서 빼기 위한 콜백 ref */
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    /**
     * ★★ **초점·스크롤잠금·키보드 — 의존은 `[open]` 뿐이다.** (BidDialog 와 동일 구조)
     */
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
        submitError != null ? createAuctionErrorViewOf(submitError) : null

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
                aria-labelledby="sellConfirmTitle"
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
                                id="sellConfirmTitle"
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
                                    경매
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <dt className="text-content-subtle">시작가</dt>
                                <dd>
                                    <CodeAmount
                                        value={startPrice}
                                        mode="full"
                                        className="font-semibold text-content-fg"
                                    />
                                </dd>
                            </div>
                            {buyNowPrice !== null && (
                                <div className="mt-2 flex items-center justify-between">
                                    <dt className="text-content-subtle">
                                        즉시구매 참고가
                                    </dt>
                                    <dd>
                                        <CodeAmount
                                            value={buyNowPrice}
                                            mode="full"
                                            className="font-semibold text-content-fg"
                                        />
                                    </dd>
                                </div>
                            )}
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <dt className="shrink-0 text-content-subtle">
                                    마감 시각
                                </dt>
                                <dd className="text-right font-semibold text-content-fg">
                                    {endAtLabel || '-'}
                                </dd>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <dt className="shrink-0 text-content-subtle">
                                    최대 연장 시각
                                </dt>
                                <dd className="text-right font-semibold text-content-fg">
                                    {maxEndAtLabel || '-'}
                                </dd>
                            </div>
                        </dl>

                        <SellFeeEstimate startPrice={startPrice} />

                        <ul className="mt-4 flex flex-col gap-1.5 rounded-lg bg-control-action-soft px-4 py-3 text-xs text-control-action-hover">
                            <li>입찰이 시작되면 가격을 변경할 수 없습니다.</li>
                            <li>입찰이 없을 때만 취소할 수 있습니다.</li>
                            <li>
                                마감 직전 입찰 시 종료 시각이 연장될 수
                                있습니다.
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
                            className="detail-cta rounded-lg bg-control-action px-5 py-2.5 text-sm font-bold text-on-strong hover:bg-control-action-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? '등록 중…' : '경매 등록 확정'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default SellConfirmDialog
