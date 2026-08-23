import { useEffect, useRef, useState } from 'react'
import { TbGavel } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import AppModal from '@/components/common/AppModal'
import { codeTierClass } from '@/components/common/codeTier'
import { formatGameMoney } from '@/features/auction/lib/auctionPrice'
import {
    isMinRaised,
    reconcileAmountWithMin,
    validateBidAmount,
} from '@/features/auction/lib/bidAmount'
import { bidErrorViewOf } from '@/features/auction/lib/bidErrors'

/**
 * 입찰 다이얼로그 (FC-072 — 목업 `.bid-dialog` · design-brief B-4 · C-6).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **FC-064 최고위험 지점. 두 결함(초점 강탈·금액 덮어쓰기)을 구조로 막는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ① **초점 강탈**(critical): 부모(상세 페이지)는 카운트다운 때문에 **매초 리렌더**된다. 이 다이얼로그도
 *    그때마다 리렌더되지만, **초점·스크롤잠금·리스너를 세우는 effect 는 의존이 `[open]` 뿐**이라
 *    open 이 바뀌지 않는 한 재실행되지 않는다 → 초점이 매초 강탈되지 않는다(모바일 키보드 유지).
 *    콜백(`onClose`)은 **ref 로 최신값을 참조**해 effect 의존에서 뺀다(인라인 콜백이 매초 새 신원이
 *    돼도 effect 가 안 흔들린다).
 *
 * ② **금액 덮어쓰기**(major·금전): `minNextBidAmount` 가 바뀔 때 사용자 입력을 **무조건 치환하지
 *    않는다** — 보존 `bidAmount.ts` 의 3갈래(프리필/사용자입력 최소가 이상 보존/미만일 때만 상향)를
 *    쓴다. 상승은 **안내로만** 말한다(스나이핑 금액 하향 치환 방지).
 *
 * ★ 전송중 버튼 `disabled` 는 **DOM 속성**(보조기술에 실제 비활성 전달). `<form noValidate>`.
 * ★ 서버 에러는 `code` 로 분기(보존 `bidErrors.ts`) — 서버 원문 노출 금지.
 */

interface BidDialogProps {
    open: boolean
    onClose: () => void
    auctionName: string
    currentHighestAmount: number | null
    /** 프리필·검증 기준(서버 파생). 종료면 null 이지만 다이얼로그는 진행 중에만 열린다 */
    minNextBidAmount: number | null
    /** 즉시구매 참고가(표기·안내용, §5 — 버튼 없음) */
    buyNowPrice: number | null
    /** 사용 가능 게임머니(GET /me/balance). 미확정이면 null */
    gameMoneyAvailable: number | null
    isSubmitting: boolean
    /** 마지막 입찰 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    onSubmit: (amount: number) => void
}

function BidDialog({
    open,
    onClose,
    auctionName,
    currentHighestAmount,
    minNextBidAmount,
    buyNowPrice,
    gameMoneyAvailable,
    isSubmitting,
    submitError,
    onSubmit,
}: BidDialogProps) {
    const [amount, setAmount] = useState('')
    /** 사용자가 금액을 직접 만졌는가 — 프리필과 사용자 의사를 가르는 유일한 근거 */
    const [edited, setEdited] = useState(false)
    /** 제출 전 클라 검증 실패 문구(서버 응답과 별개) */
    const [localError, setLocalError] = useState<string | null>(null)
    /** 최소가가 오른 사실 안내(금액을 조용히 바꾸지 않고 말로만 알린다) */
    const [raisedNotice, setRaisedNotice] = useState<string | null>(null)

    const inputRef = useRef<HTMLInputElement>(null)
    /** 최신 edited·min — effect 재실행 없이 참조 */
    const editedRef = useRef(edited)
    const minRef = useRef(minNextBidAmount)
    const previousMinRef = useRef<number | null>(minNextBidAmount)

    // 렌더 중 최신값 미러(effect 의존에 넣지 않으려는 값들)
    editedRef.current = edited
    minRef.current = minNextBidAmount

    /**
     * ★★ **초점·스크롤잠금·키보드 — 의존은 `[open]` 뿐이다.**
     * 매초 리렌더가 이 effect 를 흔들지 않는다(콜백은 ref 로 참조).
     */
    useEffect(() => {
        if (!open) return

        // 열릴 때 프리필·상태 초기화(min 은 ref 로 읽어 effect 의존을 늘리지 않는다).
        const min = minRef.current
        setAmount(min !== null ? String(min) : '')
        setEdited(false)
        setLocalError(null)
        setRaisedNotice(null)
        previousMinRef.current = min
    }, [open])

    /**
     * ★ **최소가가 바뀌었을 때만** 입력칸을 조정한다(의존 `[minNextBidAmount]`).
     * 매초 리렌더로는 값이 바뀌지 않아 실행되지 않는다 — 재조회로 실제 min 이 움직일 때만.
     * 보존 `reconcileAmountWithMin` 이 프리필/사용자입력을 구분한다(하향 치환 금지).
     */
    useEffect(() => {
        if (!open || minNextBidAmount === null) return

        setAmount((current) =>
            reconcileAmountWithMin({
                current,
                minNextBidAmount,
                edited: editedRef.current,
            }),
        )
        if (isMinRaised(previousMinRef.current, minNextBidAmount)) {
            setRaisedNotice(
                `최소 입찰가가 ${formatGameMoney(minNextBidAmount)} 로 올랐습니다.`,
            )
        }
        previousMinRef.current = minNextBidAmount
    }, [open, minNextBidAmount])

    const errorView =
        submitError != null
            ? bidErrorViewOf(submitError, minNextBidAmount)
            : null
    const amountInvalid = localError !== null || errorView?.amountFault === true
    const amountNumber = Number(amount)
    const amountTone =
        amount.length > 0 && Number.isSafeInteger(amountNumber)
            ? codeTierClass(amountNumber)
            : 'text-content-fg'
    const formattedAmount = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        const check = validateBidAmount(
            amount,
            minNextBidAmount,
            formatGameMoney,
        )
        if (!check.ok) {
            setLocalError(check.message)
            inputRef.current?.focus()
            return
        }
        setLocalError(null)
        onSubmit(check.amount)
    }

    return (
        <AppModal
            open={open}
            size="sm"
            eyebrow="안전 입찰"
            title={auctionName}
            titleIcon={<TbGavel />}
            onClose={onClose}
            closeDisabled={isSubmitting}
            initialFocusRef={inputRef}
            panelClassName="bid-entry-dialog"
            bodyClassName="!p-0"
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
                    label: '입찰 확정',
                    pendingLabel: '전송 중…',
                    variant: 'primary',
                    type: 'submit',
                    form: 'bid-entry-form',
                    pending: isSubmitting,
                },
            ]}
        >
            <form
                id="bid-entry-form"
                className="bid-entry-form"
                noValidate
                onSubmit={handleSubmit}
            >
                <div className="bid-entry-body px-5 py-5">
                    <div className="bid-entry-summary mb-5 flex flex-col gap-2 rounded-lg bg-content-soft p-3.5 text-xs text-content-muted xs:flex-row xs:justify-between">
                        <span className="flex items-center gap-1.5">
                            현재 최고가
                            <CodeAmount
                                value={currentHighestAmount}
                                mode="full"
                                className="font-bold text-content-fg"
                            />
                        </span>
                        <span className="flex items-center gap-1.5">
                            최소 입찰가
                            <CodeAmount
                                value={minNextBidAmount}
                                mode="full"
                                className="font-bold text-content-fg"
                            />
                        </span>
                    </div>

                    <label
                        htmlFor="bidAmount"
                        className="text-sm font-semibold text-content-fg"
                    >
                        입찰 금액
                    </label>
                    <div className="bid-entry-input-wrap relative mt-1.5">
                        <input
                            ref={inputRef}
                            id="bidAmount"
                            name="bidAmount"
                            className={`bid-entry-input w-full rounded-lg border bg-content-surface px-3.5 py-3 pr-16 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 ${amountTone} ${
                                amountInvalid
                                    ? 'border-danger focus:ring-danger/30'
                                    : 'border-content-line focus:border-control-action focus:ring-control-action/30'
                            }`}
                            inputMode="numeric"
                            autoComplete="off"
                            aria-describedby="bidHelp"
                            aria-invalid={amountInvalid || undefined}
                            value={formattedAmount}
                            onChange={(event) => {
                                const raw = event.target.value.replaceAll(
                                    ',',
                                    '',
                                )
                                if (!/^\d*$/.test(raw)) return
                                setEdited(true)
                                setLocalError(null)
                                setAmount(raw)
                            }}
                        />
                        <span aria-hidden className="bid-entry-input-unit">
                            코드
                        </span>
                    </div>
                    <p
                        id="bidHelp"
                        className="mt-1.5 text-xs text-content-subtle"
                    >
                        최소 입찰가 이상으로 입력하세요.
                        {buyNowPrice !== null &&
                            ' 즉시구매 참고가 미만까지 입찰할 수 있습니다.'}
                    </p>

                    <p className="bid-entry-balance mt-3 flex items-center gap-1.5 text-sm text-content-muted">
                        입찰 가능 잔액
                        <CodeAmount
                            value={gameMoneyAvailable}
                            mode="full"
                            className="font-bold text-content-fg"
                        />
                    </p>

                    {/* 최소가 상승 안내 — 금액은 그대로 두고 말로만 알린다(M-1) */}
                    {raisedNotice && (
                        <p
                            role="status"
                            className="mt-3 rounded-lg bg-control-action-soft px-3 py-2 text-xs font-medium text-control-action-hover"
                        >
                            {raisedNotice}
                        </p>
                    )}

                    {/* 클라 검증 실패 */}
                    {localError && (
                        <p
                            role="alert"
                            className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
                        >
                            {localError}
                        </p>
                    )}

                    {/* 서버 응답 실패 — code 로 분기(bidErrors) */}
                    {errorView && !localError && (
                        <div
                            role="alert"
                            className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink"
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
            </form>
        </AppModal>
    )
}

export default BidDialog
