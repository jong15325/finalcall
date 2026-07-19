import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import type { ReactNode } from 'react'

/**
 * 섹션 내부의 빈/에러 자리 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **자리를 지우지 않는다 — 다음 행동을 준다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 목록이 비었다고 섹션을 통째로 감추면 (1) 화면이 스크롤할 때마다 다른 높이로 튀고
 * (2) 손님은 **여기가 원래 뭐가 있는 곳인지 모른다.** 빈 상태는 "없음"의 보고가 아니라
 * **"그럼 뭘 하면 되는가"의 안내**다. 에러도 같다 — "실패했습니다"로 끝내지 않고 다시 시도를 준다.
 *
 * ★ **템플릿 `Alert` 를 쓰지 않았다.** `ui/Alert` 는 `framer-motion` 을 임포트하는데,
 *   FC-057 이 그 의존을 번들에서 걷어내 592→472KB(gzip 196→157KB)를 만들었다.
 *   홈의 빈/에러 자리 하나 때문에 그 성과를 되돌리지 않는다. 대신 `Card` + `Button` +
 *   템플릿 gray 스케일로 같은 일을 한다(`vite.config.ts` 의 `vendor-motion` 라벨 참조).
 */

interface SectionNoticeProps {
    /** 무슨 일이 있었나 */
    title: string
    /** 그래서 뭘 하면 되나 */
    description?: string
    /** 행동 — 다시 시도(에러) 또는 다른 곳으로(빈 목록) */
    action?: ReactNode
    onRetry?: () => void
    'data-testid'?: string
}

const SectionNotice = ({
    title,
    description,
    action,
    onRetry,
    'data-testid': testId,
}: SectionNoticeProps) => {
    return (
        <Card bodyClass="flex flex-col items-center gap-3 py-10 text-center">
            <div
                className="flex flex-col gap-1"
                data-testid={testId}
                role="status"
            >
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
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
                        <Button size="sm" onClick={onRetry}>
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
