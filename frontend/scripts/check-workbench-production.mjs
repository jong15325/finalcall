import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const buildRoot = resolve(frontendRoot, 'build')
const forbiddenMarkers = [
    '/__design',
    'FC_WORKBENCH_MARKER_284',
    'main-color-palettes',
    'auth-layout',
    'top-navigation-layouts',
    'wind-particle-studies',
    'fire-particle-studies',
    'water-particle-studies',
    'wallet-balance-studies',
    'fc-nav-restrained',
    'fc-nav-balanced',
    'fc-nav-floating',
    'fc-nav-content-companion',
    'fc-nav-contact-dock',
    'fc-nav-transition-dock',
    'fc-nav-compact-dock',
    'fc-nav-direction-dock',
    'fc-palette-cobalt',
    'fc-palette-navy-orange',
    'fc-palette-azure',
    'fc-palette-ocean',
    'fc-palette-teal',
    'fc-palette-royal',
    'fc-palette-slate',
    'fc-palette-deep-cyan',
    'fc-palette-clear-navy',
    'fc-palette-steel-blue',
    'fc-palette-emerald',
    'fc-palette-burgundy',
    'fc-palette-terracotta',
    'fc-palette-indigo',
    'fc-palette-plum',
    'fc-palette-amber',
    'fc-wind-streamline-trails',
    'fc-wind-layered-silk-ribbons',
    'fc-wind-curl-noise-field',
    'fc-wind-smoke-advection',
    'fc-wind-gust-pulse-bands',
    'fc-wind-vortex-shedding',
    'fc-wind-feathered-dashes',
    'fc-wind-luminous-dust-flow',
    'fc-wind-pressure-contours',
    'fc-wind-ribbon-mist-hybrid',
    'fc-fire-ember-plume',
    'fc-fire-flame-tongues',
    'fc-fire-heat-shimmer',
    'fc-fire-combustion-wave',
    'fc-fire-spark-fountain',
    'fc-fire-cinder-vortex',
    'fc-fire-lava-crack-glow',
    'fc-fire-smoke-ember',
    'fc-fire-flare-pulse',
    'fc-fire-hybrid-inferno',
    'fc-water-rain-impact',
    'fc-water-expanding-ripples',
    'fc-water-stream-ribbons',
    'fc-water-mist-advection',
    'fc-water-caustic-shimmer',
    'fc-water-bubble-rise',
    'fc-water-droplet-trails',
    'fc-water-wavelets',
    'fc-water-refractive-beads',
    'fc-water-hybrid-current',
    'fc-wallet-available-first',
    'fc-wallet-balance-statement',
    'fc-wallet-split-assets',
    'fc-wallet-mobile-wallet',
    'fc-wallet-balanced-metrics',
]
const failures = []

for (const file of walk(buildRoot)) {
    if (!/\.(?:js|css|html|map)$/u.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const marker of forbiddenMarkers) {
        if (source.includes(marker)) {
            failures.push(
                `${normalize(relative(frontendRoot, file))}: production 잔존 ${marker}`,
            )
        }
    }
}

if (failures.length > 0) {
    console.error('[workbench] production artifact guard 실패')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
} else {
    console.log('[workbench] production artifact 잔존 0건')
}

function* walk(directory) {
    for (const entry of readdirSync(directory)) {
        const path = resolve(directory, entry)
        if (statSync(path).isDirectory()) yield* walk(path)
        else yield path
    }
}

function normalize(path) {
    return path.replaceAll('\\', '/')
}
