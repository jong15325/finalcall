export const COLOR_PALETTE_VARIANTS = {
    cobalt: 'fc-palette-cobalt',
    azure: 'fc-palette-azure',
    ocean: 'fc-palette-ocean',
    teal: 'fc-palette-teal',
    deepCyan: 'fc-palette-deep-cyan',
    clearNavy: 'fc-palette-clear-navy',
    steelBlue: 'fc-palette-steel-blue',
    emerald: 'fc-palette-emerald',
    terracotta: 'fc-palette-terracotta',
    amber: 'fc-palette-amber',
} as const

export const COLOR_PALETTE_VARIANT_IDS = Object.values(COLOR_PALETTE_VARIANTS)

export const NAVIGATION_LAYOUT_VARIANTS = {
    restrained: 'fc-nav-restrained',
    balanced: 'fc-nav-balanced',
    floating: 'fc-nav-floating',
} as const

export const NAVIGATION_LAYOUT_VARIANT_IDS = Object.values(
    NAVIGATION_LAYOUT_VARIANTS,
)

export type NavigationLayoutVariantId =
    (typeof NAVIGATION_LAYOUT_VARIANTS)[keyof typeof NAVIGATION_LAYOUT_VARIANTS]
