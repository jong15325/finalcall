/**
 * 코드(화폐) 금액 표기 (FC-067 — rebuild-contract-map §3.2 인코딩).
 *
 * ★ **금액은 정수(long)로 다룬다.** `value` 는 원본 정수이고, 축약은 **표시 변환일 뿐**이다
 *   (상태·전송은 정수 유지 — 왕복 변환으로 정밀도를 잃지 않는다). 문자열 금액을 받지 않는다
 *   (정렬·비교·연산 정확성).
 * ★ `mode`:
 *   - `compact` → 숫자만 축약(`248만`). 목록·카드·요약(탐색).
 *   - `full`    → 천단위 구분(`2,480,000`). 입찰·지갑·정산·상세·판매(거래 확정).
 * ★ 접근성: `aria-label` 은 mode와 무관하게 항상 전체값 + 통화 단위다. 축약은 시각 표시에만 적용한다.
 * ★ 코드는 숫자에만 금액 구간색을 적용하고, 코드·캐시 단위는 중립 전경으로 표시한다.
 */
import type { CSSProperties } from 'react'
import { formatCodeCompact, formatCodeFull } from './codeFormat'

type Currency = 'code' | 'cash'

const CODE_TIER_CLASS = [
    'text-amount-code-tier-1',
    'text-amount-code-tier-2',
    'text-amount-code-tier-3',
    'text-amount-code-tier-4',
    'text-amount-code-tier-5',
    'text-amount-code-tier-6',
] as const

interface CodeAmountProps {
    /** 원본 정수 금액(long). null/undefined 는 값 없음("-")으로 표시(입찰 0건 등). */
    value: number | null | undefined
    /** 표기 모드. 기본 full(거래 정확성 우선). */
    mode?: 'compact' | 'full'
    /** 통화 단위. 기존 가격 호출은 기본 code, 캐시 값은 명시적으로 cash. */
    currency?: Currency
    /** 추가 클래스(크기·배치 조정용). */
    className?: string
    style?: CSSProperties
}

function CodeAmount({
    value,
    mode = 'full',
    currency = 'code',
    className = '',
    style,
}: CodeAmountProps) {
    // 값 없음 — 단위 없이 중립 표기. 보조기술에도 "-"로 전달.
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return (
            <span className={className} style={style}>
                -
            </span>
        )
    }

    // 안전정수 범위를 벗어나면 표기 정밀도를 보장할 수 없다(design-brief m-3).
    // 현재 계약 상한(약 99억)은 안전정수 안이라 정상 경로에선 발생하지 않는다.
    if (import.meta.env.DEV && !Number.isSafeInteger(value)) {
        console.warn(`[CodeAmount] 안전정수 범위를 벗어난 금액: ${value}`)
    }

    const full = formatCodeFull(value)
    const display = mode === 'compact' ? formatCodeCompact(value) : full
    const unit = currency === 'cash' ? '캐시' : '코드'
    const amountClass =
        currency === 'cash' ? 'text-content-fg' : codeTierClass(value)

    return (
        <span
            className={`inline-flex items-baseline gap-1 tabular-nums ${className}`}
            style={style}
            aria-label={`${full} ${unit}`}
        >
            <span aria-hidden="true" className={amountClass}>
                {display}
            </span>
            <span aria-hidden="true" className="text-content-muted">
                {unit}
            </span>
        </span>
    )
}

function codeTierClass(value: number) {
    if (value < 10_000) return CODE_TIER_CLASS[0]
    if (value < 100_000) return CODE_TIER_CLASS[1]
    if (value < 1_000_000) return CODE_TIER_CLASS[2]
    if (value < 10_000_000) return CODE_TIER_CLASS[3]
    if (value < 100_000_000) return CODE_TIER_CLASS[4]
    return CODE_TIER_CLASS[5]
}

export default CodeAmount
