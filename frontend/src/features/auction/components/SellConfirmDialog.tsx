import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import AppModal from '@/components/common/AppModal'
import SellFeeEstimate from './SellFeeEstimate'
import { createAuctionErrorViewOf } from '@/features/auction/lib/sellErrors'
import useDesktopLayout from '@/components/layout/useDesktopLayout'

/**
 * 경매 등록 확인 다이얼로그 (FC-073).
 *
 * ★ 공통 `AppModal`이 초점·스크롤잠금·Escape·Tab 가둠과 action 버튼 상태를 소유한다.
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
        submitError != null ? createAuctionErrorViewOf(submitError) : null

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
                    form: 'auction-sell-confirm-form',
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
                data-sell-confirm
                id="auction-sell-confirm-form"
                onSubmit={handleSubmit}
            >
                <div className="min-h-0">
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
                                    즉시구매가
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

                    <ul className="mt-4 flex flex-col gap-1.5 rounded-lg bg-control-action-soft px-4 py-3 text-xs text-control-action-hover">
                        <li>입찰이 시작되면 가격을 변경할 수 없습니다.</li>
                        <li>입찰이 없을 때만 취소할 수 있습니다.</li>
                        <li>
                            마감 직전 입찰 시 종료 시각이 연장될 수 있습니다.
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
                                <span className="mt-0.5 block text-danger-ink">
                                    {errorView.description}
                                </span>
                            )}
                        </div>
                    )}

                    <SellFeeEstimate startPrice={startPrice} />
                </div>
            </form>
        </AppModal>
    )
}

export default SellConfirmDialog
