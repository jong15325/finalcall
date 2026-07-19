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

/**
 * 표시 크기 — 목록 카드는 sm(메타 줄에 얹히는 문장 축), 상세의 거래 패널은 주 정보라 lg(값 축).
 * 규칙(색 전이·안내)은 공통이다.
 *
 * ★ [3.2]가 규정한 카운트다운의 **phase 연동 자동 승격**(주의 구간 28 → 임박 구간 44)은 여기서
 * 적용하지 않는다. 그건 크기가 **런타임에 변하는 동작**이라 거래 패널 레이아웃과 함께 정해져야 하고
 * FC-049 소관이다. `figure` 는 그것과 다르다 — **호출부가 고정으로 고르는 크기**이며, 화면 안에서
 * 이 수치가 주인공임을 표시할 때만 쓴다(홈 피처드 1건. "화면당 1개" 제약은 화면이 지킨다).
 */
const SIZE_CLASS = {
  sm: 'text-body',
  lg: 'text-value',
  figure: 'text-figure',
} as const;

interface CountdownProps {
  /** 마감 시각(계약 Instant ISO-8601 UTC). */
  endAt: string;
  /** 전환 안내에 붙일 맥락(예: 아이템명). 목록에서 어떤 매물인지 식별시키기 위함. */
  label?: string;
  size?: keyof typeof SIZE_CLASS;
}

export function Countdown({ endAt, label, size = 'sm' }: CountdownProps) {
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
    <span
      className={`inline-flex items-baseline gap-1.5 ${SIZE_CLASS[size]} ${PHASE_CLASS[phase]}`}
    >
      {phase === 'ended' ? (
        <span className="font-medium">마감</span>
      ) : (
        <>
          {/* 임박 신호는 색이 아니라 이 텍스트가 1차다(accessibility [2]). 값보다 작게 둬 숫자를 가리지 않는다. */}
          {phase !== 'normal' ? <span className="text-label">마감 임박</span> : null}
          <span className="font-num" aria-hidden="true">
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
