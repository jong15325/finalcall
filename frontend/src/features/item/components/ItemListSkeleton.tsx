import type { ListLayoutPreset } from '@/components/common/ListFrame'

export default function ItemListSkeleton({
    layout,
    artworkClassName = 'aspect-[72/134]',
    extendedFacts = false,
}: {
    layout: ListLayoutPreset
    artworkClassName?: string
    extendedFacts?: boolean
}) {
    if (layout === 'inventory') {
        return (
            <div className="h-[168px] animate-pulse rounded-xl bg-content-soft" />
        )
    }

    if (layout === 'two-column') {
        return (
            <div className="grid min-h-[150px] grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-xl border border-content-line bg-content-surface">
                <div className="animate-pulse bg-content-soft" />
                <div className="flex flex-col gap-2 p-[17px]">
                    <SkeletonLine className="h-3 w-1/2" />
                    <SkeletonLine className="mt-2 h-4 w-3/4" />
                    <SkeletonLine className="mt-auto h-4 w-2/3" />
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col overflow-hidden rounded-xl border border-content-line bg-content-surface">
            <div
                className={`relative ${artworkClassName} animate-pulse bg-content-soft`}
            />
            {extendedFacts && (
                <div
                    data-skeleton-auction-info-rail
                    className="flex h-[37px] items-center justify-between gap-3 border-t border-chrome-muted/40 bg-chrome-strong px-2.5"
                >
                    <SkeletonLine className="h-4 w-16 bg-chrome-muted" />
                    <SkeletonLine className="h-4 w-14 bg-chrome-muted" />
                </div>
            )}
            {extendedFacts ? (
                <div data-skeleton-extended-facts className="flex flex-col p-3">
                    <SkeletonLine className="h-[19px] w-3/4" />
                    <SkeletonLine className="mt-0.5 h-[15px] w-1/2" />
                    <div
                        data-skeleton-skills
                        className="mt-3 grid h-[98px] grid-rows-2 gap-[7px]"
                    >
                        <SkeletonLine className="h-full w-full" />
                        <SkeletonLine className="h-full w-full" />
                    </div>
                    <div className="mt-3 grid gap-1">
                        <SkeletonLine className="h-3 w-1/3" />
                        <SkeletonLine className="h-5 w-4/5" />
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-content-line pt-2.5">
                        <SkeletonLine className="h-4 w-1/3" />
                        <SkeletonLine className="h-4 flex-1" />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-1.5 p-3">
                    <SkeletonLine className="h-3 w-3/4" />
                    <SkeletonLine className="h-3 w-1/2" />
                    <SkeletonLine className="mt-2 h-7 w-full" />
                </div>
            )}
        </div>
    )
}

function SkeletonLine({ className }: { className: string }) {
    return (
        <div className={`${className} animate-pulse rounded bg-content-soft`} />
    )
}
