/* global fetch, WebSocket */
import { spawn } from 'node:child_process'
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const frontendRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const artifactRoot = resolve(
    frontendRoot,
    '..',
    '.codex',
    'artifacts',
    'FC-317',
)
const edgePath = findEdge()
const profilePath = mkdtempSync(join(tmpdir(), 'fc-chat-edge-'))
const vite = await createServer({
    configFile: resolve(frontendRoot, 'vite.config.ts'),
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
})
let edge

mkdirSync(artifactRoot, { recursive: true })

try {
    await vite.listen()
    const address = vite.httpServer?.address()
    if (!address || typeof address === 'string') {
        throw new Error('Vite 임시 포트를 확인할 수 없습니다.')
    }
    const pageUrl = `http://127.0.0.1:${address.port}/__design/chat`

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
    await cdp.send('Page.enable')

    for (const viewport of [
        { width: 390, height: 844, mobile: true },
        { width: 1280, height: 900, mobile: false },
    ]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
            ...viewport,
            deviceScaleFactor: 1,
        })
        await cdp.send('Page.navigate', { url: pageUrl })
        await waitForScenario(cdp, '[data-chat-workbench]')
        await delay(150)

        const initial = await evaluateAudit(cdp)
        assertAudit(viewport, 'initial', initial, {
            listVisible: true,
            conversationVisible: !viewport.mobile,
        })

        await focusAndAssert(cdp, '[data-chat-search]', '대화 검색')
        await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const input = document.querySelector('[data-chat-search]')
                const setter = Object.getOwnPropertyDescriptor(
                    HTMLInputElement.prototype,
                    'value',
                ).set
                setter.call(input, '없는 판매자')
                input.dispatchEvent(new Event('input', { bubbles: true }))
            })()`,
        })
        await waitForScenario(cdp, '[data-chat-empty]')
        const empty = await evaluateAudit(cdp)
        assertAudit(viewport, 'empty-search', empty, {
            listVisible: true,
            conversationVisible: !viewport.mobile,
        })
        if (!empty.emptyVisible) {
            throw new Error(
                `[chat-workbench] ${viewport.width}px 검색 빈 상태가 보이지 않습니다.`,
            )
        }
        await cdp.send('Runtime.evaluate', {
            expression:
                'document.querySelector(\'button[aria-label="검색어 지우기"]\')?.click()',
        })
        await waitForScenario(cdp, '[data-chat-contact]')

        if (viewport.mobile) {
            await capture(cdp, resolve(artifactRoot, 'chat-390-list.png'))
            await cdp.send('Runtime.evaluate', {
                expression:
                    "document.querySelector('[data-chat-contact]')?.click()",
            })
            await waitForVisible(cdp, '[data-chat-conversation]')
            await delay(100)

            const conversation = await evaluateAudit(cdp)
            assertAudit(viewport, 'conversation', conversation, {
                listVisible: false,
                conversationVisible: true,
            })
            await focusAndAssert(cdp, '#chat-preview-message', '메시지 입력')
            await capture(
                cdp,
                resolve(artifactRoot, 'chat-390-conversation.png'),
            )
        } else {
            await focusAndAssert(cdp, '#chat-preview-message', '메시지 입력')
            await capture(cdp, resolve(artifactRoot, 'chat-1280.png'))
        }

        console.log(
            `[chat-workbench] ${viewport.width}px overflow 0건 · contrast ${initial.minimumContrast.toFixed(2)}:1 · focus 확인`,
        )
    }

    cdp.close()
    console.log(`[chat-workbench] screenshots: ${artifactRoot}`)
} finally {
    await stopEdge(edge)
    await vite.close()
    await removeProfile(profilePath)
}

async function evaluateAudit(cdp) {
    const result = await cdp.send('Runtime.evaluate', {
        expression: auditExpression(),
        returnByValue: true,
    })
    return result.result.value
}

function assertAudit(viewport, state, audit, expected) {
    const failures = []
    if (!audit.documentFits) failures.push('document overflow')
    if (!audit.rootFits) failures.push('chat root overflow')
    if (!audit.controlsFit) failures.push('control boundary overflow')
    if (audit.listVisible !== expected.listVisible) {
        failures.push(`list visible=${audit.listVisible}`)
    }
    if (audit.conversationVisible !== expected.conversationVisible) {
        failures.push(`conversation visible=${audit.conversationVisible}`)
    }
    if (audit.minimumContrast < 4.5) {
        failures.push(`contrast=${audit.minimumContrast.toFixed(2)}:1`)
    }
    if (audit.focusContrast < 3) {
        failures.push(`focus contrast=${audit.focusContrast.toFixed(2)}:1`)
    }
    if (failures.length > 0) {
        throw new Error(
            `[chat-workbench] ${viewport.width}px ${state} 실패: ${failures.join(', ')}\n${JSON.stringify(audit, null, 2)}`,
        )
    }
}

async function focusAndAssert(cdp, selector, label) {
    const result = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
            const control = document.querySelector(${JSON.stringify(selector)})
            control?.focus()
            const style = control ? getComputedStyle(control) : null
            const owner = control?.closest('[data-chat-composer]')?.firstElementChild
            const ownerStyle = owner ? getComputedStyle(owner) : null
            return {
                active: document.activeElement === control,
                outlineWidth: style?.outlineWidth ?? null,
                outlineStyle: style?.outlineStyle ?? null,
                boxShadow: style?.boxShadow ?? null,
                ownerBoxShadow: ownerStyle?.boxShadow ?? null,
            }
        })()`,
        returnByValue: true,
    })
    const focus = result.result.value
    const visible =
        (focus.outlineStyle !== 'none' &&
            parseFloat(focus.outlineWidth) >= 2) ||
        focus.boxShadow !== 'none' ||
        focus.ownerBoxShadow !== 'none'
    if (!focus.active || !visible) {
        throw new Error(
            `[chat-workbench] ${label} focus 표시 실패: ${JSON.stringify(focus)}`,
        )
    }
}

async function capture(cdp, path) {
    const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
    })
    writeFileSync(path, Buffer.from(screenshot.data, 'base64'))
}

function auditExpression() {
    return `(() => {
        const root = document.querySelector('[data-chat-workbench]')
        const list = document.querySelector('[data-chat-list]')
        const conversation = document.querySelector('[data-chat-conversation]')
        const empty = document.querySelector('[data-chat-empty]')
        const visible = (element) => Boolean(
            element && getComputedStyle(element).display !== 'none' &&
            element.getBoundingClientRect().width > 0
        )
        const bounds = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return { left: rect.left, right: rect.right, width: rect.width }
        }
        const inside = (element, owner) => {
            const item = bounds(element)
            const container = bounds(owner)
            return Boolean(
                item && container &&
                item.left >= container.left - 1 &&
                item.right <= container.right + 1
            )
        }
        const controls = root
            ? [...root.querySelectorAll('button, input, textarea')].filter(visible)
            : []

        const parse = (value) => {
            const color = value.trim()
            if (color.startsWith('#')) {
                const hex = color.slice(1)
                const full = hex.length === 3
                    ? [...hex].map((part) => part + part).join('')
                    : hex
                return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16))
            }
            return (color.match(/[\\d.]+/g) ?? []).slice(0, 3).map(Number)
        }
        const luminance = (value) => {
            const [red, green, blue] = parse(value).map((channel) => {
                const normalized = channel / 255
                return normalized <= 0.03928
                    ? normalized / 12.92
                    : ((normalized + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue
        }
        const contrast = (foreground, background) => {
            const lighter = Math.max(luminance(foreground), luminance(background))
            const darker = Math.min(luminance(foreground), luminance(background))
            return (lighter + 0.05) / (darker + 0.05)
        }
        const pair = (element, backgroundOwner = element) => {
            if (!element || !backgroundOwner) return 21
            return contrast(
                getComputedStyle(element).color,
                getComputedStyle(backgroundOwner).backgroundColor,
            )
        }
        const active = root?.querySelector('[data-chat-contact-active="true"]')
        const outgoing = root?.querySelector('[data-chat-message="outgoing"]')
        const incoming = root?.querySelector('[data-chat-message="incoming"]')
        const search = root?.querySelector('[data-chat-search]')
        const searchLabel = root?.querySelector('label[for="chat-preview-search"]')
        const composer = root?.querySelector('[data-chat-composer] > div')
        const input = root?.querySelector('#chat-preview-message')
        const ratios = [
            pair(active),
            pair(outgoing),
            pair(incoming),
            searchLabel && search ? pair(searchLabel, search.parentElement) : 21,
            input && composer ? contrast(
                getComputedStyle(input, '::placeholder').color,
                getComputedStyle(composer).backgroundColor,
            ) : 21,
        ]
        const focusColor = getComputedStyle(root).getPropertyValue('--control-focus')
        const surfaceColor = getComputedStyle(root).backgroundColor

        return {
            documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            rootFits: Boolean(root && root.scrollWidth <= root.clientWidth + 1),
            controlsFit: Boolean(root && controls.length > 0 && controls.every((control) => inside(control, root))),
            listVisible: visible(list),
            conversationVisible: visible(conversation),
            emptyVisible: visible(empty),
            minimumContrast: Math.min(...ratios),
            focusContrast: contrast(focusColor, surfaceColor),
            ratios,
            widths: {
                document: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
                root: root ? [root.scrollWidth, root.clientWidth] : null,
                list: bounds(list),
                conversation: bounds(conversation),
            },
        }
    })()`
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
    throw new Error('채팅 워크벤치가 렌더되지 않았습니다.')
}

async function waitForVisible(cdp, selector) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        const result = await cdp.send('Runtime.evaluate', {
            expression: `(() => {
                const element = document.querySelector('${selector}')
                return Boolean(element && getComputedStyle(element).display !== 'none')
            })()`,
            returnByValue: true,
        })
        if (result.result.value === true) return
        await delay(50)
    }
    throw new Error(`${selector} 표시를 기다리다 시간 초과했습니다.`)
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
    for (let attempt = 1; attempt <= 8; attempt += 1) {
        try {
            rmSync(path, { recursive: true, force: true })
            return
        } catch (error) {
            if (!retryableCodes.has(error?.code)) throw error
            if (attempt === 8) return
            await delay(attempt * 100)
        }
    }
}
