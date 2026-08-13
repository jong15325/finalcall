import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Color from 'color'
import ts from 'typescript'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const sourceRoot = resolve(frontendRoot, 'src')
const workbenchRoot = resolve(sourceRoot, 'workbench')
const failures = []
const productionClassTokens = collectProductionStaticTokens()
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
    for (const token of extractClassTokens(file, source)) {
        if (!productionClassTokens.has(token)) {
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
    for (const specifier of extractModuleSpecifiers(file, source)) {
        if (resolvesToWorkbench(file, specifier)) {
            failures.push(
                `${path}: production module의 workbench import 금지 ${specifier}`,
            )
        }
    }
}

const indexCss = readFileSync(resolve(sourceRoot, 'index.css'), 'utf8')
if (!/@source not ['"]\.\/workbench['"];/u.test(indexCss)) {
    failures.push('src/index.css: Tailwind workbench source exclusion 누락')
}

checkFixtureContrast()
checkClassParserCoverage()
checkImportResolverCoverage()

const registrySource = readFileSync(
    resolve(workbenchRoot, 'registry.ts'),
    'utf8',
)
for (const specifier of extractModuleSpecifiers(
    resolve(workbenchRoot, 'registry.ts'),
    registrySource,
)) {
    if (
        resolvesToDirectory(
            resolve(workbenchRoot, 'registry.ts'),
            specifier,
            resolve(workbenchRoot, 'fixtures'),
        )
    ) {
        failures.push(
            `src/workbench/registry.ts: fixture eager import 금지 ${specifier}`,
        )
    }
}
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

function collectProductionStaticTokens() {
    const tokens = new Set()
    for (const file of walk(sourceRoot)) {
        const path = normalize(relative(frontendRoot, file))
        if (
            path.startsWith('src/workbench/') ||
            /\.(?:test|stories)\.(?:ts|tsx)$/u.test(file) ||
            !/\.(?:ts|tsx)$/u.test(file)
        )
            continue
        for (const token of extractStaticTokens(
            file,
            readFileSync(file, 'utf8'),
        )) {
            tokens.add(token)
        }
    }
    return tokens
}

function extractStaticTokens(file, source) {
    const tokens = new Set()
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    visit(sourceFile)
    return tokens

    function visit(node) {
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
        ) {
            addTokens(tokens, node.text)
        }
        ts.forEachChild(node, visit)
    }
}

function extractClassTokens(file, source) {
    const tokens = new Set()
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )

    visit(sourceFile)
    return tokens

    function visit(node) {
        if (
            ts.isJsxAttribute(node) &&
            node.name.text === 'className' &&
            node.initializer
        ) {
            collectClassLiterals(node.initializer)
        }
        ts.forEachChild(node, visit)
    }

    function collectClassLiterals(node) {
        if (
            ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
        ) {
            addTokens(tokens, node.text)
        }
        ts.forEachChild(node, collectClassLiterals)
    }
}

function addTokens(tokens, value) {
    for (const token of value.split(/\s+/u)) {
        if (/^[!\w:[\]./%-]+$/u.test(token)) tokens.add(token)
    }
}

function extractModuleSpecifiers(file, source) {
    const specifiers = []
    const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    visit(sourceFile)
    return specifiers

    function visit(node) {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text)
        }
        if (
            ts.isCallExpression(node) &&
            node.arguments.length > 0 &&
            ts.isStringLiteral(node.arguments[0]) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) &&
                    node.expression.text === 'require'))
        ) {
            specifiers.push(node.arguments[0].text)
        }
        ts.forEachChild(node, visit)
    }
}

function resolvesToWorkbench(importer, specifier) {
    return resolvesToDirectory(importer, specifier, workbenchRoot)
}

function resolvesToDirectory(importer, specifier, directory) {
    const target = specifier.startsWith('@/')
        ? resolve(sourceRoot, specifier.slice(2))
        : specifier.startsWith('.')
          ? resolve(dirname(importer), specifier)
          : undefined
    if (!target) return false
    const normalizedTarget = normalize(target).toLowerCase()
    const normalizedRoot = normalize(directory).toLowerCase()
    return (
        normalizedTarget === normalizedRoot ||
        normalizedTarget.startsWith(`${normalizedRoot}/`)
    )
}

function checkFixtureContrast() {
    const fixturePath = resolve(workbenchRoot, 'fixtures/colorSystem.ts')
    const source = readFileSync(fixturePath, 'utf8')
    const sourceFile = ts.createSourceFile(
        fixturePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )
    const tokensCss = readFileSync(
        resolve(sourceRoot, 'styles/tokens.css'),
        'utf8',
    )
    const contentSurface = readCssColor(tokensCss, '--surface')
    const chromeMuted = readCssColor(tokensCss, '--chrome-muted')
    let paletteCount = 0

    visit(sourceFile)
    if (paletteCount !== 10) {
        failures.push(
            `src/workbench/fixtures/colorSystem.ts: contrast guard가 10개 팔레트 대신 ${paletteCount}개를 찾음`,
        )
    }

    function visit(node) {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'palette'
        ) {
            paletteCount += 1
            const id = stringArgument(node, 2)
            const chromeBg = stringArgument(node, 4)
            const controlFocus = stringArgument(node, 6)
            if (id && chromeBg && chromeMuted) {
                checkContrast(
                    id,
                    '--chrome-muted / --chrome-bg',
                    chromeMuted,
                    chromeBg,
                    4.5,
                )
            }
            if (id && controlFocus && contentSurface) {
                checkContrast(
                    id,
                    '--control-focus / --content-surface',
                    controlFocus,
                    contentSurface,
                    3,
                )
            }
        }
        ts.forEachChild(node, visit)
    }
}

function stringArgument(call, index) {
    const argument = call.arguments[index]
    return argument && ts.isStringLiteral(argument) ? argument.text : undefined
}

function readCssColor(source, variable) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const match = source.match(
        new RegExp(`${escaped}:\\s*(#[\\da-f]{6})`, 'iu'),
    )
    if (!match) {
        failures.push(
            `src/styles/tokens.css: ${variable} raw color를 찾을 수 없음`,
        )
        return undefined
    }
    return match[1]
}

function checkContrast(id, pair, foreground, background, minimum) {
    const ratio = Color(foreground).contrast(Color(background))
    if (ratio < minimum) {
        failures.push(
            `src/workbench/fixtures/colorSystem.ts: ${id} ${pair} contrast ${ratio.toFixed(2)}:1 < ${minimum}:1`,
        )
    }
}

function checkClassParserCoverage() {
    const synthetic = [
        "const view = <div className={`min-w-44 ${active ? 'bg-control-action' : 'bg-content-surface'}`} />",
    ].join('\n')
    const extracted = extractClassTokens('parser-coverage.tsx', synthetic)
    for (const expected of [
        'min-w-44',
        'bg-control-action',
        'bg-content-surface',
    ]) {
        if (!extracted.has(expected)) {
            failures.push(
                `scripts/check-workbench.mjs: JSX class parser가 ${expected}를 검출하지 못함`,
            )
        }
    }
}

function checkImportResolverCoverage() {
    const cases = [
        {
            file: resolve(sourceRoot, 'app/example.ts'),
            source: "import value from '../workbench/registry'",
        },
        {
            file: resolve(sourceRoot, 'example.ts'),
            source: "export { value } from './workbench/registry'",
        },
        {
            file: resolve(sourceRoot, 'example.ts'),
            source: "const module = import('@/workbench/registry')",
        },
    ]
    for (const example of cases) {
        const [specifier] = extractModuleSpecifiers(
            example.file,
            example.source,
        )
        if (!specifier || !resolvesToWorkbench(example.file, specifier)) {
            failures.push(
                `scripts/check-workbench.mjs: import resolver가 ${specifier ?? 'specifier 없음'}을 검출하지 못함`,
            )
        }
    }
}
