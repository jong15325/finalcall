import type { ReactNode } from 'react'

/**
 * 카드 목록 그리드 정본 (EPIC-CARD-SYSTEM T3 · 제안 §2.2·§3 단계1).
 *
 * ★ **그리드 문자열·스켈레톤의 바이트 동일 복제를 한 곳으로** — 마켓·경매·인벤토리 3곳이 각자
 *   `grid grid-cols-…` 문자열과 스켈레톤을 손으로 써 드리프트했다(제안 §1.2). 반응형 열·간격을
 *   variant 로 캡슐화해 "같은 그리드 = 같은 정본"을 구조로 강제한다.
 * ★ **variant**:
 *   - `market`   : 2/3/6열 · gap-3 (마켓 시각 보존).
 *   - `auction`  : 1/2/3열 · gap-4 (경매 시각 보존).
 *   - `inventory`: 2/3/6열 · **gap-2**(FC-179 — 인벤토리만 간격 축소). 마켓과 열은 같되 밀도만 높인다.
 * ★ 래퍼 요소는 소비자가 고른다(`as`) — 마켓·경매는 `section`(aria-label region), 인벤토리는
 *   `ul`(li 슬롯). 카드 본체·오버레이·빈 슬롯은 이 컴포넌트가 건드리지 않는다(T4/T5 소관).
 */

export type ItemCardGridVariant = 'market' | 'auction' | 'inventory'

/** variant → 반응형 그리드 클래스(ready·skeleton 공유 정본). */
const GRID_CLASS: Record<ItemCardGridVariant, string> = {
    market: 'grid grid-cols-2 gap-3 xs:grid-cols-3 min-[1200px]:grid-cols-6',
    auction: 'grid grid-cols-1 gap-4 xs:grid-cols-2 min-[1200px]:grid-cols-3',
    // FC-179: 마켓과 동일한 2/3/6 열이되 간격만 gap-3 → gap-2 로 좁혀 밀도를 높인다.
    inventory: 'grid grid-cols-2 gap-2 xs:grid-cols-3 min-[1200px]:grid-cols-6',
}

interface ItemCardGridProps {
    variant: ItemCardGridVariant
    /** 접근성 라벨 — 마켓/경매는 region, 인벤토리는 list 이름. */
    ariaLabel: string
    /** 래퍼 태그. 마켓·경매=`section`, 인벤토리=`ul`. 기본 `section`. */
    as?: 'section' | 'ul'
    children: ReactNode
}

/** 카드 목록 그리드 래퍼(ready 상태). 카드들을 그대로 배치만 한다. */
export default function ItemCardGrid({
    variant,
    ariaLabel,
    as: Tag = 'section',
    children,
}: ItemCardGridProps) {
    return (
        <Tag aria-label={ariaLabel} className={GRID_CLASS[variant]}>
            {children}
        </Tag>
    )
}

/**
 * 목록 로딩 스켈레톤(그리드 영역만 — 전체 블러 금지, 목업 §18).
 * variant 별로 카드 형태 스켈레톤을 그린다(마켓=세로·경매=가로·인벤=블록). 픽셀 보존.
 */
export function ItemCardGridSkeleton({
    variant,
    count,
}: {
    variant: ItemCardGridVariant
    count: number
}) {
    return (
        <div aria-hidden className={GRID_CLASS[variant]}>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} variant={variant} />
            ))}
        </div>
    )
}

/** variant 별 단일 카드 스켈레톤(기존 페이지 스켈레톤 형상 그대로 이관). */
function SkeletonCard({ variant }: { variant: ItemCardGridVariant }) {
    if (variant === 'auction') {
        return (
            <div className="grid min-h-[256px] grid-cols-[102px_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface xs:grid-cols-[112px_minmax(0,1fr)]">
                <div className="animate-pulse bg-gray-100" />
                <div className="flex flex-col gap-2 p-[17px]">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                    <div className="mt-3 h-8 w-full animate-pulse rounded bg-gray-100" />
                    <div className="mt-auto h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                </div>
            </div>
        )
    }

    if (variant === 'inventory') {
        return (
            <div className="h-[168px] animate-pulse rounded-xl bg-gray-100" />
        )
    }

    // market — 세로 카드 스켈레톤.
    return (
        <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
            <div className="aspect-[72/134] animate-pulse bg-gray-100" />
            <div className="flex flex-col gap-1.5 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                <div className="mt-2 h-7 w-full animate-pulse rounded bg-gray-100" />
            </div>
        </div>
    )
}
