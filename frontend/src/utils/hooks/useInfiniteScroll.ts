import { LegacyRef, useEffect, useRef, useState } from 'react'

type Options = {
    offset?: string
    shouldStop?: boolean
    onLoadMore?: () => Promise<void>
}

function useInfiniteScroll(options?: Options) {
    const { offset = '0px', shouldStop = false, onLoadMore } = options ?? {}

    const [isLoading, setIsLoading] = useState(false)
    // React 19 타입은 useRef 에 초기값을 요구한다(템플릿은 React 18 기준이라 인자가 없었다).
    const observerRef = useRef<IntersectionObserver | null>(null)
    const targetRef = useRef(document.createElement('div'))

    const containerRef: LegacyRef<HTMLElement> = (container) => {
        if (container) {
            container.append(targetRef.current)
            container.style.position = 'relative'
        }
    }

    useEffect(() => {
        const target = targetRef.current
        target.toggleAttribute('data-infinite-scroll-detector', true)
        target.style.position = 'absolute'
        target.style.bottom = offset
        if (target.offsetTop < 0) target.style.bottom = '0px'
    }, [offset, isLoading])

    useEffect(() => {
        const observe = observerRef.current
        if (observe) {
            observe.disconnect()
        }

        async function handler([
            { isIntersecting },
        ]: IntersectionObserverEntry[]) {
            if (
                isIntersecting &&
                !isLoading &&
                !shouldStop &&
                typeof onLoadMore === 'function'
            ) {
                setIsLoading(true)
                await onLoadMore()
                setIsLoading(false)
            }
        }

        observerRef.current = new IntersectionObserver(
            handler as IntersectionObserverCallback,
            { threshold: 0 },
        )

        observerRef.current.observe(targetRef.current)

        return () => observe?.disconnect()
    }, [isLoading, onLoadMore, shouldStop])

    return {
        isLoading,
        containerRef,
    }
}

export default useInfiniteScroll
