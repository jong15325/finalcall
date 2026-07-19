import classNames from '@/utils/classNames'
import { countdownFrom, urgencyLabelOf } from '../lib/countdown'
import { useNow } from '../lib/useNow'

/**
 * 마감 카운트다운 표시 (FC-058).
 *
 * ★ **하드코딩된 시간이 없다.** `endAt` 하나에서 전부 파생된다(`countdown.ts`).
 *
 * ★ **급함을 색으로 말하지 않는다** — 방침상 우리 색을 못 쓰고, 템플릿 팔레트로
 *   "위험"을 표현하면 그건 우리가 고른 의미 부여다. 대신 **글자**(`곧 마감`·`초읽기`)와
 *   템플릿 타이포 관례(굵기)만 쓴다. 결과적으로 WCAG 1.4.1(색 단독 전달 금지)이 자동 충족된다.
 *
 * ★ `tabular-nums` 는 취향이 아니다 — `04:31 → 04:30` 에서 자릿폭이 흔들리면 카드가 매초
 *   덜컹인다(셸 `BalanceIndicator` 와 같은 이유).
 *
 * ★ `<time dateTime>` 으로 감싼다 — 기계가 읽을 수 있는 마감 시각을 남긴다.
 *   눈에 보이는 텍스트는 남은 시간(축약), 소리로 읽히는 것은 완전 문장이다.
 */

interface CountdownTextProps {
    /** ISO-8601 UTC (계약 §3.3 `endAt`) */
    endAt: string
    /** 피처드 카드용 큰 표기 */
    size?: 'sm' | 'lg'
    className?: string
}

const CountdownText = ({
    endAt,
    size = 'sm',
    className,
}: CountdownTextProps) => {
    const now = useNow()
    const { text, ariaText, urgency } = countdownFrom(endAt, now)
    const urgencyLabel = urgencyLabelOf(urgency)

    return (
        <time
            dateTime={endAt}
            className={classNames(
                'inline-flex items-baseline gap-2 tabular-nums text-gray-900 dark:text-gray-100',
                size === 'lg'
                    ? 'text-3xl font-bold leading-none'
                    : 'text-sm font-bold leading-none',
                className,
            )}
            data-testid="countdown"
            data-urgency={urgency}
        >
            <span aria-hidden="true">{text}</span>
            {urgencyLabel && (
                <span
                    aria-hidden="true"
                    className="text-xs font-normal text-gray-600 dark:text-gray-400"
                >
                    {urgencyLabel}
                </span>
            )}
            {/* 축약 표기("04:31")는 소리로 읽기 어렵다 — 완전 문장을 따로 준다. */}
            <span className="sr-only">
                {urgencyLabel ? `${urgencyLabel}, ${ariaText}` : ariaText}
            </span>
        </time>
    )
}

export default CountdownText
