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
    'fc-nav-restrained',
    'fc-nav-balanced',
    'fc-nav-floating',
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
