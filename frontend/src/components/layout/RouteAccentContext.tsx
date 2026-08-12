import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react'
import { matchPath, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { paths } from '@/app/paths'
import { resolveRouteUi } from '@/app/routeUi'
import type { ElementKey } from '@/features/item/lib/element'

interface RouteAccentValue {
    accent: ElementKey | null
    registerAccent: (accent: ElementKey | null) => void
}

const RouteAccentContext = createContext<RouteAccentValue>({
    accent: null,
    registerAccent: () => undefined,
})

const DYNAMIC_ACCENT_PATTERNS = [
    paths.auctionDetail,
    paths.marketDetail,
    paths.itemDetail,
] as const

function acceptsDynamicAccent(pathname: string) {
    return DYNAMIC_ACCENT_PATTERNS.some((pattern) =>
        matchPath({ path: pattern, end: true }, pathname),
    )
}

export function RouteAccentProvider({ children }: { children: ReactNode }) {
    const { pathname } = useLocation()
    const metadata = resolveRouteUi(pathname)
    const [registration, setRegistration] = useState<{
        pathname: string
        accent: ElementKey | null
    }>({ pathname, accent: null })

    const registerAccent = useCallback(
        (accent: ElementKey | null) => {
            setRegistration({
                pathname,
                accent: acceptsDynamicAccent(pathname) ? accent : null,
            })
        },
        [pathname],
    )

    const dynamicAccent =
        acceptsDynamicAccent(pathname) && registration.pathname === pathname
            ? registration.accent
            : null
    const accent =
        dynamicAccent ?? (metadata.staticAccent === 'water' ? 'water' : null)
    const value = useMemo(
        () => ({ accent, registerAccent }),
        [accent, registerAccent],
    )

    return (
        <RouteAccentContext.Provider value={value}>
            {children}
        </RouteAccentContext.Provider>
    )
}

// Provider와 소비 hook은 하나의 계약으로 함께 둔다.
// eslint-disable-next-line react-refresh/only-export-components
export function useRouteAccent() {
    return useContext(RouteAccentContext)
}

export function RouteAccentScope({
    accent,
    children,
}: {
    accent: ElementKey | null
    children: ReactNode
}) {
    return (
        <div
            className="route-accent-scope min-w-0"
            data-route-accent={accent ?? 'neutral'}
        >
            {children}
        </div>
    )
}
