import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceRoot = resolve(frontendRoot, 'src')
const tokenRegistry = 'src/styles/tokens.css'
const rawColorPattern = /#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/giu
const exactRawColorAllowlist = new Map([
    ['src/components/layout/WorldMapBackground.css', new Set([
        'rgb(229 255 178 / 0.48)', 'rgb(152 196 92 / 0.3)',
        'rgb(255 100 22 / 0.42)', 'rgb(100 220 255 / 0.38)',
    ])],
    ['src/features/item/components/ElementDetailBackground.tsx', new Set([
        'rgba(220, 255, 248, .5)', 'rgba(255, 220, 120, .72)',
        'rgba(255, 70, 20, 0)', 'rgba(255, 155, 48, .58)',
        'rgba(232, 255, 184, .72)', 'rgba(158, 205, 92, .26)',
        'rgba(84, 120, 48, 0)', 'rgba(94, 132, 56, .34)',
        'rgba(232, 250, 190, .74)', 'rgba(225, 250, 253, .62)',
        'rgba(220, 250, 255, .46)', 'rgba(220, 250, 255, ${0.55 * (1 - progress)',
        'rgba(225, 250, 253, .44)',
    ])],
    ['src/features/item/components/ItemFrame.css', new Set([
        '#263343', '#131c29', 'rgba(122, 152, 193, 0.18)',
        'rgba(10, 18, 30, 0.18)', 'rgba(3, 8, 15, 0.58)',
        'rgba(2, 8, 16, 0.54)', 'rgba(180, 200, 224, 0.55)',
        '#1f2a3a', '#0f1723', '#592400', '#fff', '#34465d', '#182536',
        'rgba(180, 209, 244, 0.2)', 'rgba(96, 143, 204, 0.14)',
        'rgba(3, 9, 19, 0.48)', 'rgb(255 255 255 / 13%)',
        'rgb(255 255 255 / 6%)', 'rgb(255 255 255 / 12%)',
        'rgb(25 178 255 / 14%)', '#19b2ff', 'rgb(255 85 0 / 13%)',
        '#ff5500', 'rgb(149 178 89 / 18%)', '#95b259',
        'rgb(102 204 204 / 18%)', '#66cccc',
    ])],
])
const legacyUtilityPattern = /(?:bg|text|border|border-t|ring|from|via|to|divide|placeholder|outline|decoration)-(?:navy(?:-\d+)?|gold(?:-(?:bright|deep|subtle))?|orange(?:-(?:deep|subtle))?|surface(?:-sunken)?|line|gray-\d+|success-subtle|danger-subtle|warning-subtle)(?:\/\d+)?\b/gu
const builtInPalettePattern = /(?:bg|text|border|border-t|ring|from|via|to|divide|placeholder|outline|decoration)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)(?:\/\d+)?\b/gu
const legacyVariablePattern = /--(?:navy(?:-\d+)?|gold(?:-(?:bright|deep|subtle))?|orange(?:-(?:deep|subtle))?|gray-\d+|success-subtle|danger-subtle|warning-subtle)\b/gu
const forbiddenApiPattern = /\b(?:AppFooterContext|useAppFooterVariant|RouteVisualTheme|routeThemeStyle|ItemCardGrid|ItemCardTile)\b/gu
const failures = []
const sources = new Map()

for (const file of walk(sourceRoot)) {
    if (!/\.(?:css|ts|tsx)$/u.test(file)) continue
    const path = normalize(relative(frontendRoot, file))
    const source = stripComments(readFileSync(file, 'utf8'))
    sources.set(path, source)
    for (const pattern of [legacyUtilityPattern, builtInPalettePattern, legacyVariablePattern, forbiddenApiPattern]) {
        for (const match of source.matchAll(pattern)) failures.push(`${path}: 금지 표기 ${match[0]}`)
    }
    if (/\[data-(?:route-accent|detail-theme)[^\]]*\][^{]*\.app-chrome/u.test(source)) {
        failures.push(`${path}: 상세/route 색이 app chrome에 누수됨`)
    }
    if (path === tokenRegistry || isTestFixture(path) || path.startsWith('src/workbench/fixtures/')) continue
    const allowed = exactRawColorAllowlist.get(path) ?? new Set()
    for (const match of source.matchAll(rawColorPattern)) {
        if (!allowed.has(match[0])) failures.push(`${path}: registry 밖 raw color ${match[0]}`)
    }
}

const tailwindSource = stripComments(readFileSync(resolve(frontendRoot, 'tailwind.config.cjs'), 'utf8'))
for (const match of tailwindSource.matchAll(rawColorPattern)) failures.push(`tailwind.config.cjs: raw color ${match[0]}`)
for (const match of tailwindSource.matchAll(/^\s*(?:navy|gold|orange|surface|line|'surface-sunken'|'gray-\d+'|'(?:success|danger|warning)-subtle')\s*:/gmu)) failures.push(`tailwind.config.cjs: legacy palette key ${match[0].trim()}`)
if (!/'control-action-ink'\s*:\s*'var\(--control-action-ink\)'/u.test(tailwindSource)) {
    failures.push('tailwind.config.cjs: control-action-ink utility 매핑 누락')
}
if (!/'control-focus-on-dark'\s*:\s*'var\(--control-focus-on-dark\)'/u.test(tailwindSource)) {
    failures.push('tailwind.config.cjs: control-focus-on-dark utility 매핑 누락')
}
for (const tier of [1, 2, 3, 4, 5, 6]) {
    const utility = `amount-code-tier-${tier}`
    if (!new RegExp(`'${utility}'\\s*:\\s*'var\\(--${utility}\\)'`, 'u').test(tailwindSource)) {
        failures.push(`tailwind.config.cjs: ${utility} utility 매핑 누락`)
    }
}

const tokens = readFileSync(resolve(frontendRoot, tokenRegistry), 'utf8')
const declarations = [...tokens.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)]
const seen = new Set()
for (const [, name] of declarations) {
    if (seen.has(name)) failures.push(`${tokenRegistry}: duplicate custom property ${name}`)
    seen.add(name)
}
const tokenValues = new Map(declarations.map(([, name, value]) => [name, value.trim()]))
for (const [name, expected] of [
    ['--brand-navy', '#32475a'],
    ['--brand-navy-900', '#273746'],
    ['--brand-navy-800', '#273746'],
    ['--brand-navy-700', '#32475a'],
    ['--action', '#3d5f7c'],
    ['--action-hover', '#2e485f'],
    ['--control-action-ink', '#ffffff'],
    ['--control-focus', '#c38000'],
    ['--control-focus-on-dark', '#c78300'],
    ['--amount-code-tier-1', '#607400'],
    ['--amount-code-tier-2', '#0075a5'],
    ['--amount-code-tier-3', '#ce00a5'],
    ['--amount-code-tier-4', '#007d00'],
    ['--amount-code-tier-5', '#a65a00'],
    ['--amount-code-tier-6', '#bd0000'],
]) {
    if (tokenValues.get(name)?.toLowerCase() !== expected) {
        failures.push(`${tokenRegistry}: ${name} 브라이트 스틸 계약값 불일치`)
    }
}
for (const tier of [1, 2, 3, 4, 5, 6]) {
    for (const surface of ['--surface', '--surface-sunken']) {
        const name = `--amount-code-tier-${tier}`
        const ratio = contrast(resolveHex(name), resolveHex(surface))
        if (ratio < 4.5) failures.push(`${tokenRegistry}: ${name}/${surface} contrast ${ratio.toFixed(2)} < 4.5`)
    }
}
for (const [ink, surface] of [
    ['--success-ink', '--success-soft'],
    ['--danger-ink', '--danger-soft'],
    ['--control-action-ink', '--control-action'],
    ['--control-action-ink', '--control-action-hover'],
]) {
    const ratio = contrast(resolveHex(ink), resolveHex(surface))
    if (ratio < 4.5) failures.push(`${tokenRegistry}: ${ink}/${surface} contrast ${ratio.toFixed(2)} < 4.5`)
}
for (const [focus, surface] of [
    ['--control-focus', '--surface'],
    ['--control-focus', '--surface-sunken'],
    ['--control-focus-on-dark', '--brand-navy'],
    ['--control-focus-on-dark', '--brand-navy-900'],
    ['--control-focus-on-dark', '--brand-navy-800'],
    ['--control-focus-on-dark', '--brand-navy-700'],
]) {
    const ratio = contrast(resolveHex(focus), resolveHex(surface))
    if (ratio < 3) failures.push(`${tokenRegistry}: ${focus}/${surface} contrast ${ratio.toFixed(2)} < 3`)
}

const indexCss = sources.get('src/index.css') ?? ''
if (!/\.app-chrome\s*\{\s*--control-focus:\s*var\(--control-focus-on-dark\);\s*\}/u.test(indexCss)) {
    failures.push('src/index.css: dark chrome focus token 소비 누락')
}

for (const [path, source] of sources) {
    if (source.includes('code.png')) failures.push(`${path}: 제거된 code.png 참조`)
}
const brandSyncSource = readFileSync(resolve(frontendRoot, 'scripts/sync-brand-assets.mjs'), 'utf8')
if (/code(?:-Photoroom)?\.png/u.test(brandSyncSource)) {
    failures.push('scripts/sync-brand-assets.mjs: 제거된 코드 화폐 자산 참조')
}
if (existsSync(resolve(frontendRoot, 'public/brand/code.png'))) {
    failures.push('public/brand/code.png: 제거된 코드 화폐 자산 잔존')
}

for (const [path, source] of sources) {
    for (const [index, line] of source.split('\n').entries()) {
        const hasActionFill = /(?<!:)\bbg-control-action(?![-/])/u.test(line)
        const hasActionHover = /\bhover:bg-control-action-hover\b/u.test(line)
        const hasWrongInk = /\b(?:hover:)?text-(?:on-strong|content-fg)\b/u.test(line)
        if (hasActionFill && hasWrongInk) {
            failures.push(`${path}:${index + 1}: control-action fill에 text-control-action-ink를 사용해야 함`)
        }
        if (hasActionFill && hasActionHover && !/\btext-control-action-ink\b/u.test(line)) {
            failures.push(`${path}:${index + 1}: primary control-action foreground 누락`)
        }
    }
    if (path.endsWith('.css')) {
        for (const match of source.matchAll(/([^{}]+)\{([^{}]*\bbackground\s*:\s*var\(--control-action\)[^{}]*)\}/gu)) {
            if (!/\bcolor\s*:\s*var\(--control-action-ink\)/u.test(match[2])) {
                failures.push(`${path}: ${match[1].trim()} control-action foreground 누락`)
            }
        }
    }
}

const listFrameContracts = new Map([
    ['src/pages/AuctionListPage.tsx', ['heading', 'filters']],
    ['src/pages/MarketPage.tsx', ['heading', 'filters']],
    ['src/pages/InventoryPage.tsx', ['heading']],
    ['src/pages/HomePage.tsx', ['heading']],
    ['src/pages/OrdersPage.tsx', ['heading', 'filters']],
    ['src/features/shop/components/MyShopsSection.tsx', ['heading']],
])
for (const [path, requiredSlots] of listFrameContracts) {
    const source = sources.get(path) ?? ''
    const start = source.indexOf('<ListFrame')
    const end = source.indexOf('</ListFrame>', start)
    if (start < 0 || end < 0) {
        failures.push(`${path}: ListFrame 구성 블록 누락`)
        continue
    }
    const frameBlock = source.slice(start, end)
    for (const slot of requiredSlots) {
        if (!new RegExp(`\\b${slot}\\s*=\\s*\\{`, 'u').test(frameBlock)) {
            failures.push(`${path}: ${slot}가 ListFrame slot 밖에 있음`)
        }
    }
    if (/\bgrid-cols-(?:1|2|3|4|6)\b/u.test(frameBlock)) {
        failures.push(`${path}: ListFrame 내부에서 grid preset 직접 복제`)
    }
}
const cardView = sources.get('src/features/item/components/ItemCardView.tsx') ?? ''
if (/from ['"](?:react-router|@\/lib\/(?:queries|stores))|\b(?:useEffect|window|addEventListener|Dialog|Mutation)\b/u.test(cardView)) failures.push('src/features/item/components/ItemCardView.tsx: view purity 위반')

if (failures.length) {
    console.error('[ui-system] 정적 guard 실패')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
} else {
    console.log('[ui-system] semantic token·chrome·card·ListFrame·contrast guard 통과')
    for (const path of exactRawColorAllowlist.keys()) console.log(`[ui-system] exact raw color registry: ${path}`)
}

function* walk(directory) { for (const entry of readdirSync(directory)) { const path = resolve(directory, entry); if (statSync(path).isDirectory()) yield* walk(path); else yield path } }
function normalize(path) { return path.replaceAll('\\', '/') }
function stripComments(source) { return source.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/^\s*\/\/.*$/gmu, '') }
function isTestFixture(path) { return /(?:^|\/)(?:test\/|[^/]+\.(?:test|spec)\.[^/]+$)/u.test(path) }
function resolveHex(name) { let value = tokenValues.get(name); const ref = value?.match(/^var\((--[\w-]+)\)$/u)?.[1]; if (ref) value = tokenValues.get(ref); if (!value || !/^#[\da-f]{6}$/iu.test(value)) throw new Error(`hex token 해석 실패: ${name}`); return value }
function contrast(a, b) { const l = [a, b].map((hex) => { const rgb = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] }); return (Math.max(...l) + 0.05) / (Math.min(...l) + 0.05) }
