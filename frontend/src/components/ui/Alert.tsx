import type { ReactNode } from 'react';

/**
 * Alert — 폼 상단 인라인 배너(의미색 -soft 배경 + 의미색 텍스트, design-system [2.3]).
 * 색만으로 전달 금지 — 텍스트가 항상 담긴다. role 은 tone 으로 결정(danger=alert, 그 외 status).
 * (전역 Toast 시스템은 이 에픽 범위 밖 — 인라인 배너로 429·성공·에러를 표현)
 */
type AlertTone = 'danger' | 'warning' | 'success' | 'info';

const TONES: Record<AlertTone, string> = {
  danger: 'bg-danger/[.08] text-danger',
  warning: 'bg-warning/[.08] text-warning',
  success: 'bg-success/[.08] text-success',
  info: 'bg-info/[.08] text-info',
};

interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      className={`rounded-md px-3 py-2 text-body ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
