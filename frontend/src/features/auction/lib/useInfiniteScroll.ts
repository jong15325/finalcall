import { useEffect, useRef } from 'react'

/**
 * 커서 무한스크롤 관찰자 (계약 §1.3 CursorPage) — FC-071.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **관찰자는 `hasNext` 가 바뀔 때만 다시 만든다 — 매초 카운트다운 리렌더에 흔들리지 않게.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 목록에는 `useNow()` 로 매초 리렌더되는 카드가 가득하다. `isFetching`·`onLoadMore` 를 effect
 * 의존성에 넣으면 그 값이 렌더마다 새로 만들어져 **관찰자가 초당 파괴·재생성**된다 — 감시 대상이
 * 잠깐씩 사라져 트리거를 놓치거나, 재부착 순간 중복 발화한다(FC-064 가 초점 강탈에서 겪은 것과
 * 같은 불안정 의존 문제다). 그래서 콜백·플래그는 **ref 로 최신값만 흘려보내고**, effect 의존은
 * `hasNext` 하나로 고정한다.
 *
 * ★ **요청 중 중복 발화 무시**: 교차 콜백 안에서 `isFetching` 을 ref 로 다시 확인한다. 관찰자가
 *   여러 프레임 연속으로 교차를 보고해도 이미 로딩 중이면 다음 페이지를 또 청하지 않는다.
 *
 * 반환한 ref 를 목록 끝 감시 요소(sentinel)에 붙인다. `hasNext=false` 면 관찰을 걸지 않는다.
 */
export interface InfiniteScrollOptions {
    hasNext: boolean
    isFetching: boolean
    onLoadMore: () => void
    /** 뷰포트 하단에서 미리 당겨오는 여백(px). 기본 200 */
    rootMargin?: number
}

export function useInfiniteScroll({
    hasNext,
    isFetching,
    onLoadMore,
    rootMargin = 200,
}: InfiniteScrollOptions) {
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const isFetchingRef = useRef(isFetching)
    const onLoadMoreRef = useRef(onLoadMore)

    // 렌더마다 최신값만 갈아끼운다 — 관찰자는 이 값을 ref 로 읽으므로 재생성되지 않는다.
    isFetchingRef.current = isFetching
    onLoadMoreRef.current = onLoadMore

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel || !hasNext) return
        if (typeof IntersectionObserver === 'undefined') return

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return
                if (isFetchingRef.current) return
                onLoadMoreRef.current()
            },
            { rootMargin: `0px 0px ${rootMargin}px 0px` },
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [hasNext, rootMargin])

    return sentinelRef
}
