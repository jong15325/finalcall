import { useEffect, useState } from 'react';

/**
 * GATEWAY_429 rate limit 카운트다운 (design-system [5.6]).
 * 인증 계열(login·signup) 연속 시도 시 발생(SEC-005). trigger(retryAfterMs) 로 초 카운트다운을 시작하고,
 * isLimited 인 동안 호출부가 제출 버튼을 잠근다. 카피는 "대기"임을 말한다(사용자 잘못 아님).
 */
export function useRateLimit() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return {
    secondsLeft,
    isLimited: secondsLeft > 0,
    /** retryAfterMs(없으면 1초 폴백) → 초 단위 카운트다운 시작 */
    trigger: (retryAfterMs?: number) => setSecondsLeft(Math.max(1, Math.ceil((retryAfterMs ?? 1000) / 1000))),
  };
}
