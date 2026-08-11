import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react'
import { matchPath, useLocation } from 'react-router'
import type { CSSProperties, ReactNode } from 'react'
import type { ElementKey } from '@/features/item/lib/element'

type DetailTheme = ElementKey | null
type ThemeStyle = CSSProperties & Record<`--${string}`, string>

const THEME_TOKENS: Record<ElementKey, ThemeStyle> = {
    water: {
        '--detail-accent': '#19b2ff',
        '--detail-chrome-surface': 'rgba(10, 24, 40, .92)',
    },
    fire: {
        '--detail-accent': '#ff5500',
        '--detail-chrome-surface': 'rgba(35, 18, 18, .92)',
    },
    earth: {
        '--detail-accent': '#95b259',
        '--detail-chrome-surface': 'rgba(23, 30, 22, .92)',
    },
    wind: {
        '--detail-accent': '#66cccc',
        '--detail-chrome-surface': 'rgba(15, 28, 34, .92)',
    },
}

const SHARED_TOKENS = {
    '--detail-chrome-border': 'rgba(255, 255, 255, .18)',
    '--detail-content-surface': 'rgba(10, 17, 28, .94)',
    '--detail-content-border': 'rgba(255, 255, 255, .2)',
    '--detail-text': '#f8fafc',
    '--detail-muted': '#cbd5e1',
    '--detail-cta-bg': '#f59e0b',
    '--detail-cta-text': '#18181b',
    '--detail-cta-hover': '#fbbf24',
    '--detail-meta-surface': 'rgba(255, 255, 255, .12)',
    '--detail-meta-text': '#f8fafc',
    '--detail-focus-ring': '#fbbf24',
} as ThemeStyle

interface RouteVisualThemeValue {
    theme: DetailTheme
    registerTheme: (theme: DetailTheme) => void
}

const RouteVisualThemeContext = createContext<RouteVisualThemeValue>({
    theme: null,
    registerTheme: () => undefined,
})

function isDetailPath(pathname: string) {
    return Boolean(
        pathname === '/auctions' ||
        pathname === '/auctions/' ||
        matchPath('/auctions/:id', pathname) ||
        matchPath('/items/:id', pathname),
    )
}

export function RouteVisualThemeProvider({
    children,
}: {
    children: ReactNode
}) {
    const { pathname } = useLocation()
    const [registration, setRegistration] = useState<{
        pathname: string
        theme: DetailTheme
    }>({ pathname, theme: null })
    const eligible = isDetailPath(pathname)

    const registerTheme = useCallback(
        (theme: DetailTheme) =>
            setRegistration({ pathname, theme: eligible ? theme : null }),
        [eligible, pathname],
    )
    const dynamicTheme =
        eligible && registration.pathname === pathname
            ? registration.theme
            : null
    const theme =
        dynamicTheme ??
        (pathname.replace(/\/$/, '') === '/auctions' ? 'water' : null)
    const value = useMemo(
        () => ({ theme, registerTheme }),
        [registerTheme, theme],
    )

    return (
        <RouteVisualThemeContext.Provider value={value}>
            {children}
        </RouteVisualThemeContext.Provider>
    )
}

// Provider와 소비 hook은 하나의 계약으로 함께 둔다.
// eslint-disable-next-line react-refresh/only-export-components
export function useRouteVisualTheme() {
    return useContext(RouteVisualThemeContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function routeThemeStyle(theme: ElementKey): ThemeStyle {
    return { ...SHARED_TOKENS, ...THEME_TOKENS[theme] }
}
