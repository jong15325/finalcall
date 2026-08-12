import { matchPath } from 'react-router'
import { paths } from './paths'

export type FooterDensity = 'default' | 'compact'
export type ContentPlane = 'default' | 'auction-list' | 'auction-detail'

export interface RouteUiMetadata {
    footer: FooterDensity
    contentPlane: ContentPlane
    staticAccent?: 'water'
}

const DEFAULT_METADATA: RouteUiMetadata = {
    footer: 'default',
    contentPlane: 'default',
}

const COMPACT_METADATA: RouteUiMetadata = {
    footer: 'compact',
    contentPlane: 'default',
}

const EXACT_METADATA = new Map<string, RouteUiMetadata>([
    [
        paths.auctions,
        {
            footer: 'default',
            contentPlane: 'auction-list',
            staticAccent: 'water',
        },
    ],
    [paths.walletCharge, COMPACT_METADATA],
])

const DYNAMIC_METADATA: ReadonlyArray<{
    pattern: string
    metadata: RouteUiMetadata
}> = [
    {
        pattern: paths.auctionDetail,
        metadata: { footer: 'default', contentPlane: 'auction-detail' },
    },
    {
        pattern: paths.marketDetail,
        metadata: { footer: 'default', contentPlane: 'auction-detail' },
    },
    {
        pattern: paths.itemDetail,
        metadata: { footer: 'default', contentPlane: 'auction-detail' },
    },
]

const KNOWN_ROUTE_PATTERNS = Object.values(paths)

/** pathname만으로 AppShell의 고정 UI 정책을 결정한다. */
export function resolveRouteUi(pathname: string): RouteUiMetadata {
    const normalized = pathname === '/' ? pathname : pathname.replace(/\/$/, '')
    const exact = EXACT_METADATA.get(normalized)
    if (exact) return exact

    const dynamic = DYNAMIC_METADATA.find(({ pattern }) =>
        matchPath({ path: pattern, end: true }, normalized),
    )
    if (dynamic) return dynamic.metadata

    const known = KNOWN_ROUTE_PATTERNS.some((pattern) =>
        matchPath({ path: pattern, end: true }, normalized),
    )
    return known ? DEFAULT_METADATA : COMPACT_METADATA
}
