import { useEffect, useState } from 'react';

/**
 * 마감 카운트다운의 **구간 판정·표기 규칙** (design-system [5.9]).
 *
 * 컴포넌트(`components/ui/Countdown.tsx`)에서 분리해 둔 이유는 두 가지다:
 * ① 순수 함수라 **단위 테스트가 렌더 없이** 돌아간다(구간 경계·"0분 남음" 같은 회귀는 여기서 잡힌다).
 * ② 컴포넌트 파일이 컴포넌트만 내보내야 HMR(react-refresh)이 온전히 동작한다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **임박 3구간은 색만 바꾸지 않는다**(FC-049 부채 10, references [1-6]).
 * 구간이 바뀔 때 네 가지가 함께 움직인다 — **표현 단위 · 갱신 주기 · 활자 크기 · CTA 문구**.
 * 이 모듈은 그중 앞의 셋(단위·주기·문구)을 담고, 활자 크기는 컴포넌트가 맡는다.
 *
 * | 구간 | 시간 표현 | 갱신 주기 | CTA |
 * |---|---|---|---|
 * | 평시(calm) | 절대 시각 / 목록은 `N일 HH:MM` | 분 | `입찰하기` |
 * | 주의(soon) | 상대 시간(분) | 분 | `입찰하기` |
 * | 임박(urgent) | 상대 시간 **초 단위** | **초** | `지금 입찰` |
 *
 * 임계값은 [5.9] 정본을 따른다 — T-5분(warning) · T-30초(danger, 소프트클로즈 윈도우).
 * references [8-5]는 정확한 임계값을 "데이터·정책 사안"으로 열어 뒀으나, 정본이 값을 갖고 있으므로
 * 프론트가 새 값을 창작하지 않는다.
 * ══════════════════════════════════════════════════════════════════════════════
 */

export type CountdownPhase = 'calm' | 'soon' | 'urgent' | 'ended';

const SOON_MS = 5 * 60 * 1000;
const URGENT_MS = 30 * 1000;

/** 갱신 주기 — 초 단위 갱신은 **임박 구간에서만**. 평시에 초당 리렌더를 20장 깔지 않는다. */
const TICK_MS: Record<CountdownPhase, number | null> = {
  calm: 30_000,
  soon: 30_000,
  urgent: 1_000,
  ended: null,
};

export function phaseOf(remainingMs: number): CountdownPhase {
  if (remainingMs <= 0) return 'ended';
  if (remainingMs <= URGENT_MS) return 'urgent';
  if (remainingMs <= SOON_MS) return 'soon';
  return 'calm';
}

/** CTA 문구도 구간과 함께 움직인다. 입찰 바·모바일 바가 이 함수를 공유해 문구가 어긋나지 않는다. */
export function bidCtaLabelFor(phase: CountdownPhase): string {
  return phase === 'urgent' ? '지금 입찰' : '입찰하기';
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function partsOf(remainingMs: number): CountdownParts {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 목록 칩 표기: 평시는 분까지(`2일 03:11`), 주의·임박은 `MM:SS`. */
export function formatChip(remainingMs: number, phase: CountdownPhase): string {
  const { days, hours, minutes, seconds } = partsOf(remainingMs);
  if (phase === 'calm') {
    return days > 0 ? `${days}일 ${pad(hours)}:${pad(minutes)}` : `${pad(hours)}:${pad(minutes)}`;
  }
  return `${pad(minutes + hours * 60)}:${pad(seconds)}`;
}

/** 상세 시간 구역의 상대 표기 — 가장 큰 두 단위까지만. */
export function formatRelative(remainingMs: number): string {
  const { days, hours, minutes } = partsOf(remainingMs);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${Math.max(minutes, 1)}분`;
}

/** 평시 표기 — "7월 21일 21:00". 연도는 붙이지 않는다(경매 기간이 해를 넘기지 않는다). */
export function formatAbsolute(endAt: string): string {
  const date = new Date(endAt);
  if (Number.isNaN(date.getTime())) return endAt;
  return date.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 스크린리더용 전체 값(축약 금지).
 *
 * ★ FC-038 이월 minor — **1분 미만은 초로 읽는다.** 분만 읽으면 임박 구간(마지막 30초) 내내
 * "0분 남음"이 되어, 정작 가장 긴박한 순간에 스크린리더 사용자만 시간을 잃는다.
 */
export function formatVerbose(remainingMs: number): string {
  const { days, hours, minutes, seconds } = partsOf(remainingMs);
  if (days === 0 && hours === 0 && minutes === 0) return `마감까지 ${seconds}초 남음`;

  const chunks: string[] = [];
  if (days > 0) chunks.push(`${days}일`);
  if (hours > 0) chunks.push(`${hours}시간`);
  if (minutes > 0) chunks.push(`${minutes}분`);
  return `마감까지 ${chunks.join(' ')} 남음`;
}

/**
 * 남은 시간 구독 훅.
 *
 * ★ **본문 값과 하단 바의 값이 어긋나면 안 된다**(references [8-3] 안티패턴). 두 곳이 각자
 * `Date.now()` 를 재면 1초씩 어긋난 두 개의 시계가 생긴다. 상세는 이 훅을 **한 번만 호출해**
 * 그 결과를 입찰 바·모바일 바에 내려보낸다.
 *
 * 종료 후에는 타이머를 걸지 않는다(마감 카드가 20장 깔려도 유휴 타이머가 남지 않는다).
 */
export function useCountdown(endAt: string): { remaining: number; phase: CountdownPhase } {
  const endMs = new Date(endAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  const remaining = Number.isNaN(endMs) ? 0 : endMs - now;
  const phase = phaseOf(remaining);
  const tick = TICK_MS[phase];

  useEffect(() => {
    if (tick === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), tick);
    return () => window.clearInterval(timer);
  }, [tick]);

  return { remaining, phase };
}
