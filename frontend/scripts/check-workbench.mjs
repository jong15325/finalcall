import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceRoot = resolve(frontendRoot, 'src')
const workbenchRoot = resolve(sourceRoot, 'workbench')
const failures = []
const productionSource = collectProductionSource()
const allowlistedVariables = new Set([
    '--chrome-bg',
    '--chrome-bg-strong',
    '--chrome-bg-raised',
    '--chrome-bg-selected',
    '--control-action',
    '--control-action-hover',
    '--control-action-ink',
    '--control-focus',
])

for (const file of walk(workbenchRoot)) {
    const path = normalize(relative(frontendRoot, file))
    if (/\.(?:css|scss|sass|less)$/u.test(file)) {
        failures.push(`${path}: workbench 전용 stylesheet 금지`)
        continue
    }
    if (!/\.(?:ts|tsx)$/u.test(file)) continue
    const source = readFileSync(file, 'utf8')
    if (/<style\b|styled\(|css`/u.test(source)) {
        failures.push(`${path}: inline/CSS-in-JS stylesheet 금지`)
    }
    if (/document\.(?:documentElement|body)\.style/u.test(source)) {
        failures.push(`${path}: 전역 style mutation 금지`)
    }
    for (const match of source.matchAll(/--[\w-]+/gu)) {
        if (!allowlistedVariables.has(match[0])) {
            failures.push(`${path}: semantic override allowlist 밖 ${match[0]}`)
        }
    }
    if (!path.startsWith('src/workbench/fixtures/')) {
        for (const match of source.matchAll(/#[\da-f]{3,8}\b/giu)) {
            failures.push(
                `${path}: raw color는 fixtures에서만 허용 ${match[0]}`,
            )
        }
    }
    if (
        /\b(?:function|class|const)\s+(?:AppShell|AuthLayout|TopNavbar|HorizontalNav|MobileBottomNav|AppFooter|ListFrame|CodeAmount)\b/u.test(
            source,
        )
    ) {
        failures.push(`${path}: shell/common component 재선언 금지`)
    }
    for (const token of extractClassTokens(source)) {
        if (!productionSource.includes(token)) {
            failures.push(
                `${path}: production source에 없는 Tailwind utility ${token}`,
            )
        }
    }
}

const routerPath = resolve(sourceRoot, 'app/router.tsx')
const router = readFileSync(routerPath, 'utf8')
if (
    !/const DevelopmentWorkbench = import\.meta\.env\.DEV\s*\?\s*lazy\(\(\) => import\('@\/workbench\/WorkbenchRoutes'\)\)\s*:\s*null/u.test(
        router,
    )
) {
    failures.push('src/app/router.tsx: DEV 조건 lazy import 경계 누락')
}
if (!/DevelopmentWorkbench !== null &&/u.test(router)) {
    failures.push('src/app/router.tsx: DEV route 조건 누락')
}

for (const file of walk(sourceRoot)) {
    const path = normalize(relative(frontendRoot, file))
    if (path.startsWith('src/workbench/') || path === 'src/app/router.tsx')
        continue
    if (!/\.(?:ts|tsx)$/u.test(file)) continue
    const source = readFileSync(file, 'utf8')
    if (/from\s+['"]@\/workbench|import\(['"]@\/workbench/u.test(source)) {
        failures.push(`${path}: production module의 workbench import 금지`)
    }
}

const indexCss = readFileSync(resolve(sourceRoot, 'index.css'), 'utf8')
if (!/@source not ['"]\.\/workbench['"];/u.test(indexCss)) {
    failures.push('src/index.css: Tailwind workbench source exclusion 누락')
}

const registrySource = readFileSync(
    resolve(workbenchRoot, 'registry.ts'),
    'utf8',
)
const scenarioIds = [
    ...registrySource.matchAll(/\bid:\s*['"]([a-z0-9-]+)['"]/gu),
].map((match) => match[1])
if (new Set(scenarioIds).size !== scenarioIds.length) {
    failures.push('src/workbench/registry.ts: scenario ID 중복')
}
for (const id of scenarioIds) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) {
        failures.push(
            `src/workbench/registry.ts: URL-safe하지 않은 scenario ID ${id}`,
        )
    }
}

if (failures.length > 0) {
    console.error('[workbench] 정적 guard 실패')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
} else {
    console.log('[workbench] route·style·override·import guard 통과')
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

function collectProductionSource() {
    const sources = []
    for (const file of walk(sourceRoot)) {
        const path = normalize(relative(frontendRoot, file))
        if (path.startsWith('src/workbench/') || !/\.(?:ts|tsx)$/u.test(file))
            continue
        sources.push(readFileSync(file, 'utf8'))
    }
    return sources.join('\n')
}

function extractClassTokens(source) {
    const tokens = new Set()
    for (const match of source.matchAll(
        /className\s*=\s*(?:['"]([^'"]*)['"]|`([^`]*)`)/gu,
    )) {
        const value = match[1] ?? match[2] ?? ''
        for (const token of value.split(/\s+/u)) {
            if (/^[\w:[\]./%-]+$/u.test(token)) tokens.add(token)
        }
    }
    return tokens
}
