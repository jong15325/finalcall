import type { AuctionStatus } from '@/types/schema';

/**
 * 경매 종료 판정 — 목록 카드·상세·폴링 중단 조건이 같은 규칙을 쓰도록 한 곳에 둔다.
 *
 * 종료는 두 갈래다:
 * - **종료 상태**(SOLD·UNSOLD·CANCELLED): 서버가 확정한 최종 상태.
 * - **마감시각 경과**(ACTIVE 인데 endAt < now): 마감 배치·조회 시점 파생이 아직 상태를 바꾸지 않은 구간.
 *   서버 `displayStatus(now)` 가 결국 정정하지만, 그 사이 화면이 "진행중"으로 보이면 거짓말이 된다.
 */
const TERMINAL_STATUSES: readonly AuctionStatus[] = ['SOLD', 'UNSOLD', 'CANCELLED'];

export function isTerminalStatus(status: AuctionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** 마감시각 경과 여부(파싱 실패는 종료로 보지 않는다 — 값 오류로 화면을 막지 않는다). */
export function isPastEnd(endAt: string, now: number = Date.now()): boolean {
  const endMs = new Date(endAt).getTime();
  return !Number.isNaN(endMs) && endMs <= now;
}

/** 화면상 "끝난 경매"인가 — 딤·마감 오버레이·CTA 비활성의 단일 기준. */
export function isAuctionEnded(
  auction: { status: AuctionStatus; endAt: string },
  now: number = Date.now(),
): boolean {
  return isTerminalStatus(auction.status) || isPastEnd(auction.endAt, now);
}
