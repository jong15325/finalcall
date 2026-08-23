import './ListBrowseMeta.css'

interface ListResultSummaryProps {
    count?: number
    query?: string | null
    fallback: string
}

/** 검색어와 현재 렌더된 결과 수를 목록 간 동일한 위계로 알린다. */
export default function ListResultSummary({
    count,
    query,
    fallback,
}: ListResultSummaryProps) {
    const normalizedQuery = query?.trim()

    return (
        <div
            data-list-result-summary
            aria-live="polite"
            aria-atomic="true"
            className="list-result-summary"
        >
            {count === undefined ? (
                <span className="list-result-summary__fallback">
                    {fallback}
                </span>
            ) : (
                <>
                    <span className="list-result-summary__context">
                        {normalizedQuery ? (
                            <>
                                <strong>“{normalizedQuery}”</strong>
                                <span>검색 결과</span>
                            </>
                        ) : (
                            <span>현재 표시 중</span>
                        )}
                    </span>
                    <span
                        aria-label={`${count}건`}
                        className="list-result-summary__count"
                    >
                        <strong>{count.toLocaleString('ko-KR')}</strong>
                        <span aria-hidden>건</span>
                    </span>
                </>
            )}
        </div>
    )
}
