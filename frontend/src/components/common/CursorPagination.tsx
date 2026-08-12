import type { Ref } from 'react'

interface CursorPaginationProps {
    sentinelRef: Ref<HTMLDivElement>
    hasNext: boolean
    isFetchingNextPage: boolean
    onLoadMore: () => void
}

/** 무한 스크롤을 유지하면서 키보드·보조기기용 명시적 다음 페이지 동작을 제공한다. */
export default function CursorPagination({
    sentinelRef,
    hasNext,
    isFetchingNextPage,
    onLoadMore,
}: CursorPaginationProps) {
    return (
        <>
            <div ref={sentinelRef} aria-hidden className="h-px" />
            {hasNext && (
                <div className="flex justify-center py-2">
                    <button
                        type="button"
                        className="min-h-11 rounded-md border border-content-line bg-content-surface px-5 py-2 text-sm font-bold text-content-fg hover:bg-content-soft disabled:cursor-wait disabled:opacity-60"
                        disabled={isFetchingNextPage}
                        onClick={onLoadMore}
                    >
                        {isFetchingNextPage ? '더 불러오는 중…' : '더 보기'}
                    </button>
                </div>
            )}
            {isFetchingNextPage && (
                <span role="status" className="sr-only">
                    다음 목록을 불러오는 중입니다.
                </span>
            )}
        </>
    )
}
