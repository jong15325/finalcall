import { PiClockCountdownDuotone, PiFireDuotone } from 'react-icons/pi'
import classNames from '@/utils/classNames'
import { countdownFrom, urgencyLabelOf } from '../lib/countdown'
import { useNow } from '../lib/useNow'

/**
 * 마감 카운트다운 표시 (FC-058 → 재작업: "마감 임박처럼 보이게").
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **급박함은 위계로 만든다. 가짜 긴급성으로 만들지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * PRODUCT.md 의 anti-reference 가 명시한다 — *"가짜 긴급성·다크패턴·조작된 다급함은 쓰지
 * 않는다. 돈을 다루는 제품에서 압박은 곧 불신이다."* 그래서 붉은 경고색·깜빡이는 배너·
 * "지금 안 사면 손해" 류를 **쓰지 않았다.**
 *
 * 대신 **진짜 데이터를 더 크고 선명하게** 만든다(impeccable `bolder` 의 product 레지스터:
 * *"bolder rarely means theatrics; it means stronger hierarchy... amplification is in
 * clarity, not drama"*):
 *  1. **크기** — `hero` 는 카드에서 가장 큰 활자다. 남은 시간이 곧 이 섹션의 주장이다.
 *  2. **아이콘** — 평시엔 시계, `critical`(30초 미만)엔 불꽃으로 **모양 자체가 바뀐다**.
 *     색이 아니라 **형태**가 상태를 나른다.
 *  3. **모션** — `critical` 에서만 맥동. 장식이 아니라 **상태 전달**이며
 *     (product.md: *"Motion conveys state, not decoration"*), `prefers-reduced-motion`
 *     에서는 완전히 멈춘다.
 *
 * ★ 임계값(5분·30초)은 **도메인 규칙**이라 손대지 않았다 — 바뀐 것은 표현뿐이다.
 * ★ `tabular-nums` 는 취향이 아니다. `04:31 → 04:30` 에서 폭이 흔들리면 카드가 매초 덜컹인다.
 * ★ `<time dateTime>` 으로 기계가 읽을 마감 시각을 남긴다.
 */

interface CountdownTextProps {
    /** ISO-8601 UTC (계약 §3.3 `endAt`) */
    endAt: string
    /** `hero` = 피처드 카드의 주인공 활자 · `sm` = 카드/행의 보조 표기 */
    size?: 'sm' | 'hero'
    className?: string
}

/*
 * ★ `hero` 가 `text-3xl`(30px)인 이유는 실측이다. 카드가 데스크톱에서 캐러셀 1/3 폭(≈400px)
 *   이고 아트·여백을 빼면 정보 열이 ≈250px 다. 여기서 "2일 3시간"을 48px 로 쓰면 **넘친다**
 *   (impeccable 절대금지: *"Text that overflows its container"*). 30px 이 그 폭에서 가장
 *   큰 안전값이라 **카드 안 최대 활자**라는 위계는 지키면서 넘치지 않는다.
 */
const SIZE_CLASS = {
    sm: 'text-sm font-bold leading-none',
    hero: 'text-3xl font-bold leading-none',
} as const

const ICON_CLASS = {
    sm: 'text-base',
    hero: 'text-2xl',
} as const

const CountdownText = ({
    endAt,
    size = 'sm',
    className,
}: CountdownTextProps) => {
    const now = useNow()
    const { text, ariaText, urgency } = countdownFrom(endAt, now)
    const urgencyLabel = urgencyLabelOf(urgency)

    const isCritical = urgency === 'critical'
    const Icon = isCritical ? PiFireDuotone : PiClockCountdownDuotone

    return (
        <time
            className={classNames(
                'inline-flex items-center gap-2 tabular-nums text-gray-900 dark:text-gray-100',
                SIZE_CLASS[size],
                className,
            )}
            dateTime={endAt}
            data-testid="countdown"
            data-urgency={urgency}
        >
            {/*
             * 아이콘이 시계→불꽃으로 바뀌는 것이 색을 대신하는 상태 신호다.
             * `motion-safe:` 접두는 Tailwind 가 `prefers-reduced-motion: no-preference`
             * 로 감싸주므로, 감소 모드에서는 맥동이 **아예 선언되지 않는다.**
             */}
            <Icon
                aria-hidden="true"
                className={classNames(
                    'shrink-0',
                    ICON_CLASS[size],
                    isCritical && 'motion-safe:animate-pulse',
                )}
            />
            <span aria-hidden="true">{text}</span>
            {urgencyLabel && size === 'sm' && (
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
