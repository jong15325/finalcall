import type { ComponentType, ReactNode } from 'react'

/**
 * 게시판 공용 상태 블록 — 로딩 뒤 빈/에러 안내 (FC-202).
 *
 * ★ 경매·마켓 화면의 `StateBlock` 과 같은 형태(dashed border·중앙 정렬·아이콘·행동버튼)를
 *   게시판 전 페이지가 공유한다([[shared-card-components]]) — 페이지마다 재구현하지 않는다.
 */
interface BoardStateBlockProps {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description?: string
    action?: ReactNode
}

export default function BoardStateBlock({
    icon: Icon,
    title,
    description,
    action,
}: BoardStateBlockProps) {
    return (
        <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-content-line bg-content-surface px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-content-soft text-content-subtle">
                <Icon aria-hidden className="size-7" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-content-fg">{title}</h2>
            {description && (
                <p className="mt-1 text-sm text-content-subtle">{description}</p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
