/* global fetch */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const edgePath = findEdge()
const profilePath = mkdtempSync(join(tmpdir(), 'fc-workbench-edge-'))
const vite = await createServer({
    configFile: resolve(frontendRoot, 'vite.config.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
})
let edge

try {
    await vite.listen()
    const address = vite.httpServer?.address()
    if (!address || typeof address === 'string') {
        throw new Error('Vite 임시 포트를 확인할 수 없습니다.')
    }
    const colorPageUrl = `http://127.0.0.1:${address.port}/__design/main-color-palettes?variant=fc-palette-steel-blue&state=success`
    const navigationPageUrl = `http://127.0.0.1:${address.port}/__design/top-navigation-layouts`
    edge = spawn(
        edgePath,
        [
            '--headless=new',
            '--disable-gpu',
            '--remote-debugging-port=0',
            `--user-data-dir=${profilePath}`,
            'about:blank',
        ],
        { stdio: 'ignore' },
    )

    const debugPort = await waitForDebugPort(profilePath)
    const page = await waitForPage(debugPort)
    const cdp = await connectCdp(page.webSocketDebuggerUrl)
    for (const viewport of [
        { width: 390, height: 844, mobile: true },
        { width: 1280, height: 900, mobile: false },
    ]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            ...viewport,
            deviceScaleFactor: 1,
        })
        await cdp.send('Page.navigate', { url: colorPageUrl })
        await waitForScenario(cdp, '[data-testid=color-system-scenario]')
        const result = await cdp.send('Runtime.evaluate', {
            expression: layoutAuditExpression(),
            returnByValue: true,
        })
        const audit = result.result.value
        if (process.env.WORKBENCH_LAYOUT_DEBUG === '1') {
            console.log(JSON.stringify({ viewport, ...audit }, null, 2))
        }
        if (!audit.documentFits || audit.violations.length > 0) {
            console.error(
                `[workbench] ${viewport.width}px 실제 DOM overflow guard 실패`,
            )
            console.error(JSON.stringify(audit, null, 2))
            process.exitCode = 1
        } else {
            console.log(
                `[workbench] ${viewport.width}px 실제 DOM overflow 0건 (${audit.document.scrollWidth}/${audit.document.clientWidth}px)`,
            )
        }

        const navigationVariants = viewport.mobile
            ? ['fc-nav-balanced']
            : ['fc-nav-restrained', 'fc-nav-balanced', 'fc-nav-floating']
        for (const variant of navigationVariants) {
            await cdp.send('Page.navigate', {
                url: `${navigationPageUrl}?variant=${variant}`,
            })
            await waitForScenario(
                cdp,
                '[data-testid=navigation-layout-scenario]',
            )
            if (!viewport.mobile) {
                await waitForScenario(cdp, '[data-workbench-nav-measure]')
            }
            const navigationResult = await cdp.send('Runtime.evaluate', {
                expression: navigationAuditExpression(viewport.mobile),
                returnByValue: true,
            })
            const navigationAudit = navigationResult.result.value
            if (process.env.WORKBENCH_LAYOUT_DEBUG === '1') {
                console.log(
                    JSON.stringify(
                        { viewport, variant, navigation: navigationAudit },
                        null,
                        2,
                    ),
                )
            }
            const navigationFailed = viewport.mobile
                ? !navigationAudit.documentFits ||
                  !navigationAudit.safeArea ||
                  !navigationAudit.mobileUsable
                : !navigationAudit.documentFits ||
                  !navigationAudit.aligned ||
                  navigationAudit.desktopMenuCount === 0
            if (navigationFailed) {
                console.error(
                    `[workbench] ${viewport.width}px ${variant} navigation layout guard 실패`,
                )
                console.error(JSON.stringify(navigationAudit, null, 2))
                process.exitCode = 1
            } else if (viewport.mobile) {
                console.log(
                    `[workbench] ${viewport.width}px mobile safe gutter·menu usability 통과`,
                )
            } else {
                console.log(
                    `[workbench] ${viewport.width}px ${variant} navigation/footer alignment ${navigationAudit.delta.left}/${navigationAudit.delta.right}/${navigationAudit.delta.width}px`,
                )
            }
        }
    }
    cdp.close()
} finally {
    await stopEdge(edge)
    await vite.close()
    await removeProfile(profilePath)
}

async function stopEdge(process) {
    if (!process || process.exitCode !== null) return

    const exited = new Promise((resolveExit) => {
        process.once('exit', resolveExit)
    })
    process.kill()
    await Promise.race([exited, delay(2_000)])
}

async function removeProfile(path) {
    const retryableCodes = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM'])
    const attempts = 8

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            rmSync(path, { recursive: true, force: true })
            return
        } catch (error) {
            if (!retryableCodes.has(error?.code)) throw error
            if (attempt === attempts) {
                console.warn(
                    `[workbench] Edge 임시 프로필 정리를 건너뜁니다 (${error.code}): ${path}`,
                )
                return
            }
            await delay(attempt * 100)
        }
    }
}

function findEdge() {
    const candidates = [
        process.env.BROWSER_BIN,
        process.env['PROGRAMFILES(X86)']
            ? join(
                  process.env['PROGRAMFILES(X86)'],
                  'Microsoft/Edge/Application/msedge.exe',
              )
            : undefined,
        process.env.PROGRAMFILES
            ? join(
                  process.env.PROGRAMFILES,
                  'Microsoft/Edge/Application/msedge.exe',
              )
            : undefined,
    ].filter(Boolean)
    const found = candidates.find((candidate) => existsSync(candidate))
    if (!found) {
        throw new Error(
            'Edge를 찾을 수 없습니다. BROWSER_BIN에 Chromium 계열 브라우저 경로를 지정하세요.',
        )
    }
    return found
}

async function waitForDebugPort(profile) {
    const activePortFile = join(profile, 'DevToolsActivePort')
    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (existsSync(activePortFile)) {
            return Number(
                readFileSync(activePortFile, 'utf8').split(/\r?\n/u)[0],
            )
        }
        await delay(50)
    }
    throw new Error('Edge DevTools 포트가 열리지 않았습니다.')
}

async function waitForPage(port) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const pages = await fetch(
                `http://127.0.0.1:${port}/json/list`,
            ).then((response) => response.json())
            const page = pages.find(({ type }) => type === 'page')
            if (page) return page
        } catch {
            // Edge가 DevTools HTTP endpoint를 여는 동안 재시도한다.
        }
        await delay(50)
    }
    throw new Error('Edge page target을 찾을 수 없습니다.')
}

async function connectCdp(url) {
    const socket = new WebSocket(url)
    const pending = new Map()
    let sequence = 0
    await new Promise((resolveOpen, rejectOpen) => {
        socket.addEventListener('open', resolveOpen, { once: true })
        socket.addEventListener('error', rejectOpen, { once: true })
    })
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data)
        const request = pending.get(message.id)
        if (!request) return
        pending.delete(message.id)
        if (message.error) request.reject(new Error(message.error.message))
        else request.resolve(message.result)
    })
    return {
        send(method, params = {}) {
            sequence += 1
            return new Promise((resolveRequest, rejectRequest) => {
                pending.set(sequence, {
                    resolve: resolveRequest,
                    reject: rejectRequest,
                })
                socket.send(JSON.stringify({ id: sequence, method, params }))
            })
        },
        close() {
            socket.close()
        },
    }
}

async function waitForScenario(cdp, selector) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const result = await cdp.send('Runtime.evaluate', {
            expression: `document.querySelector('${selector}') !== null`,
            returnByValue: true,
        })
        if (result.result.value === true) return
        await delay(50)
    }
    throw new Error('워크벤치 시나리오가 렌더되지 않았습니다.')
}

function navigationAuditExpression(mobile) {
    return `(() => {
        const documentElement = document.documentElement
        const mobileNav = document.querySelector('nav.fixed.inset-x-0')
        const navTarget = document.querySelector('[data-workbench-nav-measure]')
        const footerTarget = document.querySelector('[data-workbench-footer-measure]')
        const bounds = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return {
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
                height: Math.round(rect.height * 100) / 100,
            }
        }
        const navBounds = bounds(navTarget)
        const footerBounds = bounds(footerTarget)
        const delta = navBounds && footerBounds
            ? {
                  left: Math.abs(navBounds.left - footerBounds.left),
                  right: Math.abs(navBounds.right - footerBounds.right),
                  width: Math.abs(navBounds.width - footerBounds.width),
              }
            : null
        const mobileBounds = bounds(mobileNav)
        const mobileItems = mobileNav
            ? [...mobileNav.children].map(bounds).filter(Boolean)
            : []
        return {
            documentFits: documentElement.scrollWidth <= documentElement.clientWidth,
            navBounds,
            footerBounds,
            delta,
            aligned: Boolean(delta && delta.left <= 1 && delta.right <= 1 && delta.width <= 1),
            desktopMenuCount: document.querySelectorAll('[data-horizontal-root]:not([disabled])').length,
            safeArea: Boolean(mobileNav && String(mobileNav.className).includes('pb-[env(safe-area-inset-bottom)]')),
            mobileUsable: Boolean(
                ${mobile} &&
                mobileBounds &&
                mobileBounds.left >= -1 &&
                mobileBounds.right <= documentElement.clientWidth + 1 &&
                mobileItems.length > 0 &&
                mobileItems.every((item) => item.width >= 44 && item.height >= 44)
            ),
            mobileBounds,
            mobileItems,
        }
    })()`
}

function layoutAuditExpression() {
    return `(() => {
        const palette = document.querySelector('[data-testid="palette-selector"]')
        const scenario = document.querySelector('[data-testid="color-system-scenario"]')
        const visible = (element) => {
            const style = getComputedStyle(element)
            return style.display !== 'none' && style.visibility !== 'hidden'
        }
        const metrics = (element) => {
            const style = getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return {
                tag: element.tagName.toLowerCase(),
                testId: element.getAttribute('data-testid'),
                className: String(element.className).slice(0, 180),
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: style.width,
                minWidth: style.minWidth,
                maxWidth: style.maxWidth,
                overflowX: style.overflowX,
                overflowWrap: style.overflowWrap,
                wordBreak: style.wordBreak,
            }
        }
        const scenarioElements = scenario
            ? [scenario, ...scenario.querySelectorAll('*')]
            : []
        const layoutAncestors = [
            document.querySelector('#root'),
            document.querySelector('#view'),
            document.querySelector('[data-testid="app-content-plane"]'),
        ].filter(Boolean)
        const violations = [...layoutAncestors, ...scenarioElements]
            .filter((element) => visible(element))
            .filter((element) => element !== palette && !palette?.contains(element))
            .filter((element) => element.scrollWidth > element.clientWidth + 1)
            .map(metrics)
        const chain = [
            document.documentElement,
            document.body,
            document.querySelector('#root'),
            document.querySelector('[data-testid="app-content-plane"]'),
            document.querySelector('[data-testid="color-system-scenario"]'),
            document.querySelector('[data-testid="palette-preview-grid"]'),
            document.querySelector('article'),
            document.querySelector('dl'),
            document.querySelector('[data-testid="semantic-token-row"]'),
            document.querySelector('[data-testid="semantic-token-row"] dt'),
            document.querySelector('[data-testid="semantic-token-row"] dd'),
        ].filter(Boolean).map(metrics)
        return {
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            document: metrics(document.documentElement),
            palette: palette ? metrics(palette) : null,
            violations,
            chain,
        }
    })()`
}
