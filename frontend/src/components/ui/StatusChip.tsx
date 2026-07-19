import type { ReactNode } from 'react';

/**
 * StatusChip — design-system [5.8].
 * 의미색 **8% 알파 배경 + 의미색 텍스트 + 상태명**. 색 단독 전달 금지라 라벨 텍스트가 항상 병기된다
 * (accessibility [2]). 반경은 pill(`rounded-full`).
 *
 * `-soft` 는 별도 토큰이 아니라 알파 합성이 정본이다([2.3]) → Tailwind 불투명도 수식(`/[0.08]`)으로 표현한다.
 * `neutral` 은 의미색이 아닌 상태(예: 예정)를 위한 중립 톤이다 — 새 색이 아니라 기존 표면·텍스트 토큰 조합이다.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<StatusTone, string> = {
  success: 'bg-success/[0.08] text-success',
  warning: 'bg-warning/[0.08] text-warning',
  danger: 'bg-danger/[0.08] text-danger',
  info: 'bg-info/[0.08] text-info',
  neutral: 'bg-surface-sunken text-text-muted',
};

export function StatusChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
