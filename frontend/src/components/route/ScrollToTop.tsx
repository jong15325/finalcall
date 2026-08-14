import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const DESIGN_ROUTE_PREFIX = '/__design'

function isDesignRoute(pathname: string) {
    return (
        import.meta.env.DEV &&
        (pathname === DESIGN_ROUTE_PREFIX ||
            pathname.startsWith(`${DESIGN_ROUTE_PREFIX}/`))
    )
}

/** 새 문서 경로로 이동할 때만 viewport를 상단으로 초기화한다. */
function ScrollToTop() {
    const { pathname } = useLocation()
    const navigationType = useNavigationType()
    const previousPathname = useRef(pathname)

    useEffect(() => {
        const previousPath = previousPathname.current
        const pathnameChanged = previousPath !== pathname
        previousPathname.current = pathname

        if (
            !pathnameChanged ||
            navigationType === 'POP' ||
            isDesignRoute(previousPath) ||
            isDesignRoute(pathname)
        ) {
            return
        }

        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, [navigationType, pathname])

    return null
}

export default ScrollToTop
