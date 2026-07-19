/**
 * 골드포스 파생 (design-system [5.12], 계약 §3.3 주).
 *
 * 서버는 만료 시각(`goldforceExpireAt`, nullable)만 준다 — **활성 여부·잔여 기간은 클라 파생**이다.
 * 골드포스는 아이템에 붙는 **시간제 상태**이며 별도 아이템 종류가 아니다([5.12] 해소 절).
 *
 * ★ 색 단독 전달 금지: 금색 아웃라인은 **보조 신호**이고, 정보는 배지·본문줄·sr-only 3경로로 전달한다.
 * "아웃라인을 전부 제거해도 정보 손실이 없어야 한다"가 합격선이다. 이 모듈은 그 텍스트 경로를 만든다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GoldforceState {
  active: boolean;
  /** 남은 기간 짧은 표기("9일" · "5시간" · "40분"). 비활성이면 null. */
  remainingLabel: string | null;
  /** 만료 임박(24시간 이내). [5.12]의 임시 기준이며 정책 확정 전까지 표기 강도에만 쓴다. */
  expiringSoon: boolean;
}

const INACTIVE: GoldforceState = { active: false, remainingLabel: null, expiringSoon: false };

/**
 * 만료 시각 → 표시 상태.
 * `null`·파싱 실패·이미 만료는 전부 비활성이다(값 오류로 화면을 막지 않는다).
 */
export function goldforceStateOf(
  expireAt: string | null | undefined,
  now: number = Date.now(),
): GoldforceState {
  if (!expireAt) return INACTIVE;

  const expireMs = new Date(expireAt).getTime();
  if (Number.isNaN(expireMs)) return INACTIVE;

  const remaining = expireMs - now;
  if (remaining <= 0) return INACTIVE;

  return {
    active: true,
    remainingLabel: formatRemaining(remaining),
    expiringSoon: remaining <= DAY_MS,
  };
}

/** 가장 큰 단위 하나로만 적는다 — 목록에서 "8일 3시간 12분"은 읽히지 않는다. */
function formatRemaining(remainingMs: number): string {
  const minutes = Math.floor(remainingMs / 60_000);
  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}일`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}시간`;
  return `${Math.max(minutes, 1)}분`;
}
