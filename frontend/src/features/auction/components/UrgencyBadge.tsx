import { PiFireDuotone, PiHourglassHighDuotone } from 'react-icons/pi'
import classNames from '@/utils/classNames'
import { countdownFrom, urgencyLabelOf } from '../lib/countdown'
import { useNow } from '../lib/useNow'

/**
 * 임박 상태 배지 (FC-058 재작업).
 *
 * ★ 피처드 카드에서 `CountdownText hero` 는 숫자만 크게 보여준다. **그 숫자가 "급하다"는
 *   뜻인지는 사람마다 기준이 다르다** — 3분이 급한지 아닌지는 경매를 해본 사람만 안다.
 *   그 판정(도메인 규칙 5분·30초)을 **글자로 확정**해 주는 것이 이 배지다.
 *
 * ★ **평시(normal)에는 아무것도 렌더하지 않는다.** 모든 카드에 상태 배지가 붙으면 배지가
 *   배경이 되어 정작 임박한 것이 묻힌다(impeccable: *"If every element is louder, the
 *   composition is not bolder; it is flatter"*).
 *
 * ★ 색이 아니라 **아이콘 모양 + 낱말**이 상태를 나른다 — 모래시계(임박) ↔ 불꽃(초읽기).
 *   면은 템플릿 그레이다. 붉은 경고색을 쓰지 않은 이유는 `CountdownText` 주석 참조
 *   (PRODUCT.md anti-reference: 조작된 다급함 금지).
 */

interface UrgencyBadgeProps {
    endAt: string
    className?: string
}

const UrgencyBadge = ({ endAt, className }: UrgencyBadgeProps) => {
    const now = useNow()
    const { urgency } = countdownFrom(endAt, now)
    const label = urgencyLabelOf(urgency)

    if (!label || urgency === 'normal') return null

    const Icon = urgency === 'critical' ? PiFireDuotone : PiHourglassHighDuotone

    return (
        <span
            data-testid="urgency-badge"
            data-urgency={urgency}
            className={classNames(
                'inline-flex items-center gap-1 rounded-md bg-gray-900 px-2 py-1 text-xs font-bold leading-none text-white',
                'dark:bg-gray-100 dark:text-gray-900',
                className,
            )}
        >
            <Icon aria-hidden="true" className="text-sm" />
            {label}
        </span>
    )
}

export default UrgencyBadge
