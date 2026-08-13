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

export const FIRE_PARTICLE_VARIANTS = {
    emberPlume: 'fc-fire-ember-plume',
    flameTongues: 'fc-fire-flame-tongues',
    heatShimmer: 'fc-fire-heat-shimmer',
    combustionWave: 'fc-fire-combustion-wave',
    sparkFountain: 'fc-fire-spark-fountain',
    cinderVortex: 'fc-fire-cinder-vortex',
    lavaCrack: 'fc-fire-lava-crack-glow',
    smokeEmber: 'fc-fire-smoke-ember',
    flarePulse: 'fc-fire-flare-pulse',
    hybridInferno: 'fc-fire-hybrid-inferno',
} as const

export const FIRE_PARTICLE_VARIANT_IDS = Object.values(FIRE_PARTICLE_VARIANTS)

export type FireParticleVariantId =
    (typeof FIRE_PARTICLE_VARIANTS)[keyof typeof FIRE_PARTICLE_VARIANTS]

export const WATER_PARTICLE_VARIANTS = {
    rainImpact: 'fc-water-rain-impact',
    expandingRipples: 'fc-water-expanding-ripples',
    streamRibbons: 'fc-water-stream-ribbons',
    mistAdvection: 'fc-water-mist-advection',
    causticShimmer: 'fc-water-caustic-shimmer',
    bubbleRise: 'fc-water-bubble-rise',
    dropletTrails: 'fc-water-droplet-trails',
    wavelets: 'fc-water-wavelets',
    refractiveBeads: 'fc-water-refractive-beads',
    hybridCurrent: 'fc-water-hybrid-current',
} as const

export const WATER_PARTICLE_VARIANT_IDS = Object.values(WATER_PARTICLE_VARIANTS)

export type WaterParticleVariantId =
    (typeof WATER_PARTICLE_VARIANTS)[keyof typeof WATER_PARTICLE_VARIANTS]
