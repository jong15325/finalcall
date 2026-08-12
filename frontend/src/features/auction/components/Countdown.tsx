import { TbClock } from 'react-icons/tb'
import { countdownFrom, urgencyLabelOf } from '@/features/auction/lib/countdown'

/**
 * 마감 카운트다운 표시 (FC-071 — design-brief C-5·D "카운트다운").
 *
 * ★ **순수 표시 컴포넌트다 — 시계를 스스로 돌리지 않는다.** `now` 를 밖에서 주입받는다.
 *   목록/상세는 `useNow()` 를 **한 번만** 구독해 그 값을 전 카드에 내려보낸다(단일 타이머,
 *   `useNow.ts`). 컴포넌트마다 타이머를 걸면 카드 20장의 숫자가 제각각 튄다.
 * ★ **마감 판정은 `countdownFrom`(= `now >= endAt`)** 이 한다 — 서버 status 를 믿지 않는다
 *   (마감 강등 워커 부재, rebuild-contract-map 주의 3). 파싱 불가·마감은 "마감"으로 흘린다.
 * ★ **임박은 색 + 글자 두 채널**로 낸다 — 색 단독 금지(WCAG 1.4.1). `aria-label` 은 완전 문장.
 */

const URGENCY_CLASS: Record<string, string> = {
    ended: 'text-content-subtle',
    critical: 'text-danger-ink',
    urgent: 'text-control-action-hover',
    normal: 'text-content-muted',
}

interface CountdownProps {
    /** 마감 시각(ISO-8601 UTC) */
    endAt: string
    /** 현재 시각(ms) — 밖에서 주입(단일 타이머) */
    now: number
    className?: string
}

function Countdown({ endAt, now, className = '' }: CountdownProps) {
    const countdown = countdownFrom(endAt, now)
    const urgencyLabel = urgencyLabelOf(countdown.urgency)

    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold tabular-nums xs:text-xs ${
                URGENCY_CLASS[countdown.urgency] ?? URGENCY_CLASS.normal
            } ${className}`.trim()}
            aria-label={countdown.ariaText}
        >
            <TbClock aria-hidden className="size-3.5 shrink-0" />
            <span aria-hidden="true">{countdown.text}</span>
            {urgencyLabel && countdown.urgency !== 'ended' && (
                <span
                    aria-hidden="true"
                    className="rounded bg-current/10 px-1 py-0.5 text-[10px] font-semibold"
                >
                    {urgencyLabel}
                </span>
            )}
        </span>
    )
}

export default Countdown
