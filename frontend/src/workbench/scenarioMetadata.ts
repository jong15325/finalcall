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
    contactDock: 'fc-nav-contact-dock',
    transitionDock: 'fc-nav-transition-dock',
    compactDock: 'fc-nav-compact-dock',
    directionDock: 'fc-nav-direction-dock',
} as const

export const NAVIGATION_LAYOUT_VARIANT_IDS = Object.values(
    NAVIGATION_LAYOUT_VARIANTS,
)

export type NavigationLayoutVariantId =
    (typeof NAVIGATION_LAYOUT_VARIANTS)[keyof typeof NAVIGATION_LAYOUT_VARIANTS]

export const WIND_PARTICLE_VARIANTS = {
    streamline: 'fc-wind-streamline-trails',
    silkRibbon: 'fc-wind-layered-silk-ribbons',
    curlNoise: 'fc-wind-curl-noise-field',
    smoke: 'fc-wind-smoke-advection',
    gustBands: 'fc-wind-gust-pulse-bands',
    vortex: 'fc-wind-vortex-shedding',
    feathered: 'fc-wind-feathered-dashes',
    dust: 'fc-wind-luminous-dust-flow',
    pressure: 'fc-wind-pressure-contours',
    hybrid: 'fc-wind-ribbon-mist-hybrid',
} as const

export const WIND_PARTICLE_VARIANT_IDS = Object.values(WIND_PARTICLE_VARIANTS)

export type WindParticleVariantId =
    (typeof WIND_PARTICLE_VARIANTS)[keyof typeof WIND_PARTICLE_VARIANTS]
