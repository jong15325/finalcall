/**
 * 표시 포맷 헬퍼. 금액은 design-system [5.10] 규약(천단위 구분 + font-num tabular-nums)을 따르며,
 * 여기서는 숫자→문자열 변환만 담당한다(색·타이포는 소비 컴포넌트 책임).
 */

/** 금액 천단위 구분(ko-KR). 게임머니·캐시 공통. */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('ko-KR');
}

/** Instant(UTC) ISO → 로컬 표시. 파싱 실패 시 원문 유지. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('ko-KR');
}
