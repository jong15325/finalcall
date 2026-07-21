import { useState } from 'react'
import { TbArrowRight } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import { exchangeErrorMessage } from '@/features/member/lib/exchangeErrors'
import type { ExchangeResponse } from '@/lib/api/exchange'

/**
 * 캐시 → 게임머니 교환 폼 (FC-075 — 목업 `.exchange-form`) · design-brief B-8.
 *
 * ★ **방향 고정(CASH_TO_GAME).** 역방향은 미지원이라 방향 선택 UI 를 두지 않는다(§ rebuild 주의).
 * ★ **환율은 서버가 소유한다(ON-HOLD 스텁).** 제출 전 지급액을 클라가 계산·표기하지 않는다
 *   — 비율을 하드코딩하면 금전 정보를 날조하게 된다. 지급액·`appliedRate` 는 **성공 응답에서만** 표기.
 * ★ 금액은 **정수(long)** — 입력에서 숫자만 남기고, 안전정수/보유 캐시 상한을 가드한다(m-3).
 * ★ `<form noValidate>` — 브라우저 말풍선과 커스텀 검증이 이중으로 뜨는 것 방지(design-brief B-4).
 *   제출 버튼 비활성은 **DOM `disabled`**(색만 X).
 */

interface ExchangeFormProps {
    /** 가용 캐시(정수). 상한 검증·안내용. 로딩 중이면 undefined. */
    cashBalance: number | undefined
    isSubmitting: boolean
    /** 마지막 교환 실패(ApiError). 성공·초기화 시 null */
    submitError: unknown
    /** 마지막 교환 성공 결과. 없으면 undefined */
    result: ExchangeResponse | undefined
    /** 교환 요청(부모가 변이 실행) */
    onExchange: (cashAmount: number) => void
}

/** 입력 문자열 → 정수. 숫자 외 제거 후 파싱. 빈 값·0·비안전정수는 null. */
function parseAmount(raw: string): number | null {
    const digits = raw.replace(/[^\d]/g, '')
    if (digits.length === 0) return null
    const value = Number(digits)
    if (!Number.isSafeInteger(value) || value <= 0) return null
    return value
}

function ExchangeForm({
    cashBalance,
    isSubmitting,
    submitError,
    result,
    onExchange,
}: ExchangeFormProps) {
    const [raw, setRaw] = useState('')
    /** 제출 전 클라 검증 실패 — 서버 응답과 별개 */
    const [localError, setLocalError] = useState<string | null>(null)

    const amount = parseAmount(raw)
    const exceedsCash =
        amount !== null && cashBalance !== undefined && amount > cashBalance
    const canSubmit = amount !== null && !exceedsCash && !isSubmitting

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault()
        if (amount === null) {
            setLocalError('교환할 캐시 금액을 정수로 입력해 주세요.')
            return
        }
        if (exceedsCash) {
            setLocalError('보유한 캐시를 초과할 수 없습니다.')
            return
        }
        setLocalError(null)
        onExchange(amount)
    }

    const serverError =
        submitError != null ? exchangeErrorMessage(submitError) : null
    const errorMessage = localError ?? serverError

    return (
        <section className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-base font-bold text-gray-900">
                캐시 → 게임머니 교환
            </h2>
            <p className="mt-1 text-xs text-gray-500">
                현재 지원되는 방향(캐시 → 게임머니)으로만 교환할 수 있습니다.
            </p>

            <form
                noValidate
                className="mt-5 flex flex-col gap-4"
                onSubmit={handleSubmit}
            >
                <div>
                    <label
                        htmlFor="exchangeCash"
                        className="text-sm font-semibold text-gray-700"
                    >
                        교환할 캐시
                    </label>
                    <input
                        id="exchangeCash"
                        name="cashAmount"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        aria-invalid={errorMessage ? true : undefined}
                        aria-describedby={
                            errorMessage ? 'exchangeCashError' : undefined
                        }
                        className={`mt-1.5 w-full rounded-lg border bg-surface px-3.5 py-2.5 text-base font-semibold tabular-nums text-gray-900 focus:outline-none focus:ring-2 ${
                            errorMessage
                                ? 'border-danger focus:ring-danger/30'
                                : 'border-line focus:border-orange focus:ring-orange/30'
                        }`}
                        value={raw}
                        onChange={(event) => {
                            setLocalError(null)
                            // 숫자만 유지 — 상태·전송은 정수(축약 왕복 없음)
                            setRaw(event.target.value.replace(/[^\d]/g, ''))
                        }}
                    />
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
                        보유 캐시
                        <CodeAmount
                            value={cashBalance ?? null}
                            mode="full"
                            className="font-semibold text-gray-500"
                        />
                    </p>
                </div>

                {/* 지급 결과 — 성공 응답에서만(환율은 서버 소유) */}
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                    <TbArrowRight
                        aria-hidden
                        className="size-5 shrink-0 text-gray-400"
                    />
                    <div className="min-w-0">
                        <span className="text-xs font-semibold text-gray-500">
                            받은 게임머니
                        </span>
                        {result ? (
                            <>
                                <CodeAmount
                                    value={result.gameMoneyAmount}
                                    mode="full"
                                    className="mt-0.5 text-lg font-bold text-gray-900"
                                />
                                <p className="mt-0.5 text-xs text-gray-400">
                                    적용 환율 1 : {result.appliedRate}
                                </p>
                            </>
                        ) : (
                            <p className="mt-0.5 text-sm text-gray-400">
                                교환 후 지급액이 여기에 표시됩니다.
                            </p>
                        )}
                    </div>
                </div>

                {errorMessage && (
                    <p
                        id="exchangeCashError"
                        role="alert"
                        className="text-sm text-danger"
                    >
                        {errorMessage}
                    </p>
                )}
                {result && !errorMessage && (
                    <p role="status" className="text-sm text-success">
                        교환이 완료되었습니다.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting ? '교환 중…' : '교환하기'}
                </button>
            </form>
        </section>
    )
}

export default ExchangeForm
