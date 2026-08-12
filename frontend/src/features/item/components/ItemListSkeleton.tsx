import type { ListLayoutPreset } from '@/components/common/ListFrame'

export default function ItemListSkeleton({
    layout,
}: {
    layout: ListLayoutPreset
}) {
    if (layout === 'auction') {
        return (
            <div className="grid min-h-[256px] grid-cols-[102px_minmax(0,1fr)] overflow-hidden rounded-xl border border-content-line bg-content-surface xs:grid-cols-[112px_minmax(0,1fr)]">
                <div className="animate-pulse bg-content-soft" />
                <div className="flex flex-col gap-2 p-[17px]">
                    <SkeletonLine className="h-4 w-3/4" />
                    <SkeletonLine className="h-3 w-1/2" />
                    <SkeletonLine className="mt-3 h-8 w-full" />
                    <SkeletonLine className="mt-auto h-3 w-2/3" />
                </div>
            </div>
        )
    }

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
            <div className="aspect-[72/134] animate-pulse bg-content-soft" />
            <div className="flex flex-col gap-1.5 p-3">
                <SkeletonLine className="h-3 w-3/4" />
                <SkeletonLine className="h-3 w-1/2" />
                <SkeletonLine className="mt-2 h-7 w-full" />
            </div>
        </div>
    )
}

function SkeletonLine({ className }: { className: string }) {
    return (
        <div className={`${className} animate-pulse rounded bg-content-soft`} />
    )
}
