/**
 * 코드(화폐) 표기 포맷터 (FC-067 — rebuild-contract-map §3.2).
 *
 * ★ 축약은 **표시 변환일 뿐**이다 — 상태·전송은 정수를 유지한다(왕복 변환으로 정밀도를 잃지
 *   않는다). `<CodeAmount>` 와 분리해 순수 함수로 둔다(테스트·재사용·fast-refresh 안정).
 */

/** 소수 1자리로 축약하되 정수면 소수점 제거(`248` / `2.5`). */
function trimDecimal(x: number): string {
    const rounded = Math.round(x * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
}

/**
 * 축약 표기(`1만` / `248만` / `99억`). 탐색용 시각 변환.
 * 억(1e8) → 만(1e4) 순으로 최상위 단위만 쓴다. 만 미만은 천단위 구분.
 */
export function formatCodeCompact(value: number): string {
    const sign = value < 0 ? '-' : ''
    const abs = Math.abs(value)
    if (abs >= 1e8) return `${sign}${trimDecimal(abs / 1e8)}억`
    if (abs >= 1e4) return `${sign}${trimDecimal(abs / 1e4)}만`
    return `${sign}${abs.toLocaleString('ko-KR')}`
}

/** 전체값 천단위 구분(`2,480,000`). 거래 확정·aria-label 용. */
export function formatCodeFull(value: number): string {
    return value.toLocaleString('ko-KR')
}
