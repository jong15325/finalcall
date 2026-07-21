/**
 * 코드(화폐) 금액 표기 (FC-067 — rebuild-contract-map §3.2 인코딩).
 *
 * ★ **금액은 정수(long)로 다룬다.** `value` 는 원본 정수이고, 축약은 **표시 변환일 뿐**이다
 *   (상태·전송은 정수 유지 — 왕복 변환으로 정밀도를 잃지 않는다). 문자열 금액을 받지 않는다
 *   (정렬·비교·연산 정확성).
 * ★ `mode`:
 *   - `compact` → 축약(`248만`) + 아이콘. 목록·카드·요약(탐색).
 *   - `full`    → 천단위 구분(`2,480,000`) + 아이콘. 입찰·지갑·정산·상세·판매(거래 확정).
 * ★ 접근성(HANDOVER §24): `aria-label` 은 **mode 와 무관하게 항상 전체값 + " 코드"**. 축약은
 *   시각에만, 보조기술엔 전체값. 아이콘은 장식이므로 `aria-hidden`.
 * ★ `G`·`C`·`골드` 텍스트 단위 금지 — 단위는 아이콘(code.png)으로만 표기.
 */
import type { CSSProperties } from 'react'
import { formatCodeCompact, formatCodeFull } from './codeFormat'

/** 코드 화폐 아이콘 — `scripts/sync-brand-assets.mjs` 가 public/brand 로 복사한다. */
const CODE_ICON_SRC = '/brand/code.png'

interface CodeAmountProps {
    /** 원본 정수 금액(long). null/undefined 는 값 없음("-")으로 표시(입찰 0건 등). */
    value: number | null | undefined
    /** 표기 모드. 기본 full(거래 정확성 우선). */
    mode?: 'compact' | 'full'
    /** 추가 클래스(크기·색 조정용). */
    className?: string
    style?: CSSProperties
}

function CodeAmount({
    value,
    mode = 'full',
    className = '',
    style,
}: CodeAmountProps) {
    // 값 없음 — 아이콘 없이 중립 표기. 보조기술에도 "-"로 전달.
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

    return (
        <span
            className={`inline-flex items-center gap-1 tabular-nums ${className}`}
            style={style}
            aria-label={`${full} 코드`}
        >
            <img
                src={CODE_ICON_SRC}
                alt=""
                aria-hidden="true"
                className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.15em]"
            />
            <span aria-hidden="true">{display}</span>
        </span>
    )
}

export default CodeAmount
