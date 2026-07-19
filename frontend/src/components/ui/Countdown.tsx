import { useEffect, useRef, useState } from 'react';
import {
  formatAbsolute,
  formatChip,
  formatRelative,
  formatVerbose,
  useCountdown,
} from '@/lib/countdown';
import type { CountdownPhase } from '@/lib/countdown';

/**
 * Countdown — design-system [5.9]. 구간 판정·표기 규칙은 `lib/countdown.ts` 가 갖는다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ FC-049 부채 10 — **임박 3구간은 색만 바꾸지 않는다.**
 * 같은 모양에 색만 바꾸면 주변시(peripheral)에서 구분되지 않고, 색각 이상·저시력에서는 아예 사라진다.
 * 그래서 구간이 바뀌면 **칩의 종류 자체가 바뀌고**(함몰 회색 → 소프트 앰버 + 링 → 솔리드 적색),
 * 동시에 표현 단위·갱신 주기·활자 크기·CTA 문구가 함께 움직인다.
 *
 * ★ **긴박의 주된 운반체는 색이 아니라 활자 크기·표현 단위다**([3.1] 원칙 5). 색은 보조다.
 *   목업이 제안한 **퍼플 승격은 채택하지 않았다** — [1.2]가 퍼플을 액센트(링크·포커스·선택)로
 *   가두고 있고, 승격은 references [8-5]가 **디자인 게이트 대상**으로 남긴 미결이다.
 *   정본 [5.9]가 규정한 의미색(warning → danger)을 보조로 쓴다.
 *
 * 접근성(accessibility [6]):
 * - 값 자체는 **aria-live=off** 다(초당 갱신을 읽으면 스팸). 시각 값은 `aria-hidden`, 스크린리더에는
 *   축약 아닌 전체 문장을 준다.
 * - **구간 전환 시점에만** polite 로 한 번 안내한다.
 * - 색 단독 전달 금지 — 마감·임박은 색이 아니라 텍스트가 1차 신호다.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/** 구간 전환 시 1회 안내(초당 갱신은 안내하지 않는다). 최초 렌더는 전환이 아니므로 침묵한다. */
function usePhaseAnnouncement(phase: CountdownPhase, label?: string): string {
  const [announcement, setAnnouncement] = useState('');
  const previous = useRef<CountdownPhase | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = phase;
    if (before === null || before === phase) return;
    const prefix = label ? `${label} ` : '';
    if (phase === 'ended') setAnnouncement(`${prefix}마감되었습니다`);
    else if (phase === 'urgent') setAnnouncement(`${prefix}마감 30초 전`);
    else if (phase === 'soon') setAnnouncement(`${prefix}마감 5분 전`);
  }, [phase, label]);

  return announcement;
}

/**
 * ★ 목록 카드용 칩 — **색이 아니라 칩의 종류가 바뀐다.**
 * 평시 함몰 회색 → 주의 소프트 앰버 + 링 → 임박 솔리드 적색 + 흰 글자 + 점멸 점.
 *
 * 대비(FC-049 반환에 계산 근거): muted on sunken 6.33 · warning on warning-soft 5.12 ·
 * white on danger 5.74 — 전건 AA 통과.
 */
const CHIP_CLASS: Record<CountdownPhase, string> = {
  calm: 'bg-surface-sunken text-text-muted',
  soon: 'bg-warning/[0.08] text-warning ring-1 ring-inset ring-warning/30',
  urgent: 'bg-danger text-white',
  ended: 'bg-surface-sunken text-text-subtle',
};

const PIP_CLASS: Record<CountdownPhase, string> = {
  calm: 'bg-border-strong',
  soon: 'bg-warning',
  urgent: 'bg-white motion-safe:animate-pulse',
  ended: 'bg-border-strong',
};

interface CountdownProps {
  endAt: string;
  /** 전환 안내에 붙일 맥락(예: 아이템명). 목록에서 어떤 매물인지 식별시키기 위함. */
  label?: string;
}

export function CountdownChip({ endAt, label }: CountdownProps) {
  const { remaining, phase } = useCountdown(endAt);
  const announcement = usePhaseAnnouncement(phase, label);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-label ${CHIP_CLASS[phase]}`}
    >
      {phase === 'ended' ? (
        '마감'
      ) : (
        <>
          <span
            className={`h-1.5 w-1.5 flex-none rounded-full ${PIP_CLASS[phase]}`}
            aria-hidden="true"
          />
          <span className="font-num" aria-hidden="true">
            {formatChip(remaining, phase)}
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

/**
 * 홈 피처드용 — 그 화면의 **주인공 수치**(화면당 1개, [3.1] 원칙 4). 항상 상대 시간이다.
 * 홈은 "지금 마감되는 경매"를 말하는 자리라 절대 시각으로 바꾸면 문장과 어긋난다.
 */
export function CountdownFigure({ endAt, label }: CountdownProps) {
  const { remaining, phase } = useCountdown(endAt);
  const announcement = usePhaseAnnouncement(phase, label);

  return (
    <span
      className={`font-num text-figure ${
        phase === 'urgent' ? 'text-danger' : phase === 'soon' ? 'text-warning' : 'text-text'
      }`}
    >
      {phase === 'ended' ? (
        '마감'
      ) : (
        <>
          <span aria-hidden="true">{formatChip(remaining, phase)}</span>
          <span className="sr-only">{formatVerbose(remaining)}</span>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </span>
  );
}

/**
 * 상세 거래 바용 시간 구역 — **표현 단위와 활자 단계가 함께 승격**한다.
 * 평시는 절대 시각(references [1-4] "평시엔 절대 시각 우선"), 주의는 상대 분, 임박은 상대 초.
 *
 * `text-figure-xl`(44)은 화면당 1개 제약이 걸린 단계라 **임박 구간에서만** 쓴다 — 평시에는
 * 상세의 주인공 수치가 현재가이고, 임박에 들어서면 주인공이 시간으로 넘어간다([3.1] 원칙 4).
 *
 * ★ 시계를 자체 구독하지 않는다 — 상위가 단일 시계에서 받은 값을 내려준다(값 불일치 방지).
 */
export function CountdownZone({
  endAt,
  phase,
  remaining,
  label,
}: CountdownProps & { phase: CountdownPhase; remaining: number }) {
  const announcement = usePhaseAnnouncement(phase, label);

  if (phase === 'ended') {
    return (
      <p className="font-num text-value text-text-subtle">
        마감됨
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </p>
    );
  }

  return (
    <p
      className={
        phase === 'urgent'
          ? 'font-num text-figure-xl text-danger'
          : phase === 'soon'
            ? 'font-num text-figure text-warning'
            : 'font-num text-value text-text'
      }
    >
      <span aria-hidden="true">
        {phase === 'calm'
          ? formatAbsolute(endAt)
          : phase === 'soon'
            ? formatRelative(remaining)
            : formatChip(remaining, phase)}
      </span>
      <span className="sr-only">{formatVerbose(remaining)}</span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </p>
  );
}
