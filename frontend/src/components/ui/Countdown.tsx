import { useEffect, useRef, useState } from 'react';

/**
 * Countdown — design-system [5.9].
 *
 * font-num(폭 고정으로 초당 갱신 시 레이아웃 점프 없음) + `HH:MM:SS` / `Nd HH:MM`.
 * 임박 단계 색 전이: 여유(`text-muted`) → T-5분(`warning`) → T-30초(`danger`). 종료 시 "마감" 정적 표시.
 *
 * 접근성(accessibility [6]):
 * - 값 자체는 **aria-live=off** 다 — 초당 갱신을 읽으면 스팸이 된다. 시각 값은 aria-hidden 으로 두고
 *   스크린리더에는 축약 아닌 전체 값(sr-only)을 준다([5] 금액·시간 규칙).
 * - 대신 **임박·마감 전환 시점에만** 별도 polite 영역으로 한 번 안내한다.
 * - 색 단독 전달 금지 — 임박·마감은 색이 아니라 텍스트(`마감 임박`·`마감`)가 1차 신호다.
 */
type Phase = 'normal' | 'soon' | 'urgent' | 'ended';

const SOON_MS = 5 * 60 * 1000;
const URGENT_MS = 30 * 1000;

const PHASE_CLASS: Record<Phase, string> = {
  normal: 'text-text-muted',
  soon: 'text-warning',
  urgent: 'text-danger',
  ended: 'text-text-subtle',
};

function phaseOf(remainingMs: number): Phase {
  if (remainingMs <= 0) return 'ended';
  if (remainingMs <= URGENT_MS) return 'urgent';
  if (remainingMs <= SOON_MS) return 'soon';
  return 'normal';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 시각 표기: 1일 이상 남으면 `Nd HH:MM`, 그 외 `HH:MM:SS`. */
function formatCompact(remainingMs: number): string {
  const total = Math.floor(remainingMs / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** 스크린리더용 전체 값(축약 금지). */
function formatVerbose(remainingMs: number): string {
  const total = Math.floor(remainingMs / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (hours > 0) parts.push(`${hours}시간`);
  parts.push(`${minutes}분`);
  return `마감까지 ${parts.join(' ')} 남음`;
}

interface CountdownProps {
  /** 마감 시각(계약 Instant ISO-8601 UTC). */
  endAt: string;
  /** 전환 안내에 붙일 맥락(예: 아이템명). 목록에서 어떤 매물인지 식별시키기 위함. */
  label?: string;
}

export function Countdown({ endAt, label }: CountdownProps) {
  const endMs = new Date(endAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const previousPhase = useRef<Phase | null>(null);

  const remaining = Number.isNaN(endMs) ? 0 : endMs - now;
  const phase = phaseOf(remaining);

  // 종료 후에는 타이머를 멈춘다(마감 카드가 20장 깔려도 유휴 타이머가 남지 않는다).
  useEffect(() => {
    if (phase === 'ended') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  // 전환 시점 1회 안내(초당 갱신은 안내하지 않는다). 최초 렌더는 전환이 아니므로 침묵한다.
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = phase;
    if (previous === null || previous === phase) return;
    const prefix = label ? `${label} ` : '';
    if (phase === 'ended') setAnnouncement(`${prefix}마감되었습니다`);
    else if (phase === 'urgent') setAnnouncement(`${prefix}마감 30초 전`);
    else if (phase === 'soon') setAnnouncement(`${prefix}마감 5분 전`);
  }, [phase, label]);

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${PHASE_CLASS[phase]}`}>
      {phase === 'ended' ? (
        <span className="font-medium">마감</span>
      ) : (
        <>
          {phase !== 'normal' ? <span className="font-medium">마감 임박</span> : null}
          <span className="font-num tabular-nums" aria-hidden="true">
            {formatCompact(remaining)}
          </span>
          <span className="sr-only">{formatVerbose(remaining)}</span>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}
