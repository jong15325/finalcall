import { PiArrowClockwiseBold } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import type { ReactElement, ReactNode } from 'react'

/**
 * 섹션 내부의 빈/에러 자리 (FC-058 → 재작업 → FC-064 에서 `components/shared` 로 이동).
 *
 * ★ **세 번째 소비처가 생겨서 옮겼다** — 홈 두 섹션 · 경매 목록 · 경매 상세. 목록이 이미
 *   `views/home/components/` 를 가로질러 임포트하고 있었고(화면 간 결합), 상세까지 그러면
 *   "홈 전용" 이라는 위치가 거짓이 된다. **내용은 한 줄도 바꾸지 않았다** — 이동뿐이다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **자리를 지우지 않는다 — 다음 행동을 준다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 목록이 비었다고 섹션을 통째로 감추면 (1) 스크롤할 때마다 높이가 튀고 (2) 손님은
 * **여기가 원래 뭐가 있는 곳인지 모른다.** 빈 상태는 "없음"의 보고가 아니라
 * **"그럼 뭘 하면 되는가"의 안내**다(product.md: *"Empty states that teach the interface"*).
 *
 * ★ **템플릿 `Alert` 를 쓰지 않았다.** `ui/Alert` 는 `framer-motion` 을 임포트하는데,
 *   FC-057 이 그 의존을 번들에서 걷어내 592→472KB(gzip 196→157)를 만들었다.
 *   홈의 빈/에러 자리 하나 때문에 그 성과를 되돌리지 않는다.
 *   대신 `Card` + `Button` + 템플릿 gray 스케일로 같은 일을 한다.
 *
 * ★ 아이콘은 **상태마다 다른 모양**을 받는다 — 빈 상태와 실패는 사용자가 해야 할 일이
 *   다르므로(기다림 vs 재시도) 같은 그림이면 안 된다.
 */

interface SectionNoticeProps {
    /** 무슨 일이 있었나 */
    title: string
    /** 그래서 뭘 하면 되나 */
    description?: string
    icon?: ReactElement
    /** 행동 — 다시 시도(에러) 또는 다른 곳으로(빈 목록) */
    action?: ReactNode
    onRetry?: () => void
    'data-testid'?: string
}

const SectionNotice = ({
    title,
    description,
    icon,
    action,
    onRetry,
    'data-testid': testId,
}: SectionNoticeProps) => {
    return (
        <Card bodyClass="flex flex-col items-center gap-4 py-12 text-center">
            {icon && (
                <span
                    aria-hidden="true"
                    className="flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-2xl text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                >
                    {icon}
                </span>
            )}
            <div
                className="flex max-w-md flex-col gap-1"
                data-testid={testId}
                role="status"
            >
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {title}
                </p>
                {description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {description}
                    </p>
                )}
            </div>
            {(action || onRetry) && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {onRetry && (
                        <Button
                            size="sm"
                            icon={<PiArrowClockwiseBold />}
                            onClick={onRetry}
                        >
                            다시 시도
                        </Button>
                    )}
                    {action}
                </div>
            )}
        </Card>
    )
}

export default SectionNotice
