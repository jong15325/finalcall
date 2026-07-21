import type { ComponentType, ReactNode } from 'react'
import { TbTool } from 'react-icons/tb'

/**
 * 빈 셸 · 준비 중 안내 (FC-067).
 *
 * ★ 두 쓰임:
 *   - `variant="coming-soon"` — 백엔드 미구현(고정가 마켓·커뮤니티·충전 등). "준비 중" 배지.
 *     클릭 시 404 대신 이 안내로 자리를 지킨다(rebuild-contract-map §5).
 *   - `variant="shell"` — 실연동 라우트의 **빈 셸**. 후속 티켓(FC-068+)이 본문을 채운다.
 * ★ 순수 표시 컴포넌트 — 미구현 엔드포인트를 호출하지 않는다(FC-048 사고 방지).
 */
interface PlaceholderViewProps {
    title: string
    description?: ReactNode
    variant?: 'coming-soon' | 'shell'
    icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    /** 후속 티켓 표기(예: FC-070) */
    ticket?: string
}

function PlaceholderView({
    title,
    description,
    variant = 'shell',
    icon: Icon = TbTool,
    ticket,
}: PlaceholderViewProps) {
    const comingSoon = variant === 'coming-soon'
    return (
        <section className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <span
                className={`flex size-14 items-center justify-center rounded-2xl ${
                    comingSoon
                        ? 'bg-gold-subtle text-gold-deep'
                        : 'bg-navy text-gold-bright'
                }`}
            >
                <Icon aria-hidden className="size-7" />
            </span>

            {comingSoon && (
                <span className="mt-4 rounded-full bg-gold-subtle px-3 py-1 text-xs font-bold text-gold-deep">
                    준비 중
                </span>
            )}

            <h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2>

            {description && (
                <p className="mt-2 max-w-md text-sm text-gray-500">
                    {description}
                </p>
            )}

            {ticket && (
                <p className="mt-4 text-xs font-medium text-gray-300">
                    {ticket}
                </p>
            )}
        </section>
    )
}

export default PlaceholderView
