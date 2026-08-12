import { Fragment } from 'react'
import type { ReactNode } from 'react'

export type ListFrameState =
    | { kind: 'loading'; count: number }
    | { kind: 'error'; message: string; onRetry: () => void }
    | {
          kind: 'empty'
          title: string
          description?: string
          action?: ReactNode
      }
    | { kind: 'ready' }

export type ListLayoutPreset =
    'catalog' | 'auction' | 'inventory' | 'preview' | 'two-column'

const GRID_CLASS: Record<ListLayoutPreset, string> = {
    catalog: 'grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6',
    auction: 'grid grid-cols-1 gap-4 xs:grid-cols-2 min-[1200px]:grid-cols-3',
    inventory: 'grid grid-cols-2 gap-2 xs:grid-cols-3 min-[1200px]:grid-cols-6',
    preview: 'grid grid-cols-2 gap-3 xs:grid-cols-3 md:grid-cols-6',
    'two-column': 'grid grid-cols-1 gap-4 min-[1000px]:grid-cols-2',
}

interface ListGridProps {
    layout: ListLayoutPreset
    as?: 'section' | 'ul'
    label?: string
    hidden?: boolean
    children: ReactNode
}

/** ready와 loading이 함께 소비하는 유일한 grid resolver. */
export function ListGrid({
    layout,
    as: Tag = 'section',
    label,
    hidden,
    children,
}: ListGridProps) {
    return (
        <Tag
            aria-label={label}
            aria-hidden={hidden || undefined}
            className={GRID_CLASS[layout]}
        >
            {children}
        </Tag>
    )
}

export interface ListFrameProps {
    state: ListFrameState
    layout: ListLayoutPreset
    label: string
    as?: 'section' | 'ul'
    heading?: ReactNode
    filters?: ReactNode
    resultBar?: ReactNode
    pagination?: ReactNode
    renderSkeleton: (index: number) => ReactNode
    children?: ReactNode
}

/** 목록 header·filter·state·grid·pagination의 공통 순서를 고정한다. */
export default function ListFrame({
    state,
    layout,
    label,
    as = 'section',
    heading,
    filters,
    resultBar,
    pagination,
    renderSkeleton,
    children,
}: ListFrameProps) {
    const loading = state.kind === 'loading'

    return (
        <div
            data-ui-list-frame="root"
            className="flex min-w-0 flex-col gap-5"
        >
            {heading}
            {filters}
            {resultBar}

            <div aria-busy={loading || undefined} aria-live="polite">
                {state.kind === 'loading' && (
                    <ListGrid hidden as={as} layout={layout}>
                        {Array.from({ length: state.count }, (_, index) => (
                            <Fragment key={index}>
                                {renderSkeleton(index)}
                            </Fragment>
                        ))}
                    </ListGrid>
                )}

                {state.kind === 'error' && (
                    <StatePanel
                        title="목록을 불러오지 못했습니다"
                        description={state.message}
                        action={
                            <button
                                type="button"
                                className="rounded-md bg-control-action px-4 py-2 text-body font-bold text-control-action-ink hover:bg-control-action-hover"
                                onClick={state.onRetry}
                            >
                                다시 시도
                            </button>
                        }
                    />
                )}

                {state.kind === 'empty' && (
                    <StatePanel
                        title={state.title}
                        description={state.description}
                        action={state.action}
                    />
                )}

                {state.kind === 'ready' && (
                    <ListGrid layout={layout} as={as} label={label}>
                        {children}
                    </ListGrid>
                )}
            </div>

            {state.kind === 'ready' ? pagination : null}
        </div>
    )
}

function StatePanel({
    title,
    description,
    action,
}: {
    title: string
    description?: string
    action?: ReactNode
}) {
    return (
        <section className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-dashed border-content-line bg-content-surface px-6 py-16 text-center">
            <h2 className="text-value font-bold text-content-fg">{title}</h2>
            {description && (
                <p className="mt-1 max-w-[65ch] text-body text-content-muted">
                    {description}
                </p>
            )}
            {action && <div className="mt-5">{action}</div>}
        </section>
    )
}
