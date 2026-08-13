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
    const walletPageUrl = `http://127.0.0.1:${address.port}/__design/wallet-balance-studies?variant=fc-wallet-balanced-metrics&state=ready&sample=long`
    const walletTypographyVariants = [
        ['fc-wallet-available-first', '32px'],
        ['fc-wallet-mobile-wallet', '32px'],
        ['fc-wallet-balanced-metrics', '28px'],
    ]
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

        for (const [variant, expectedFontSize] of walletTypographyVariants) {
            await cdp.send('Page.navigate', {
                url: `http://127.0.0.1:${address.port}/__design/wallet-balance-studies?variant=${variant}&state=ready&sample=standard`,
            })
            await waitForScenario(cdp, `[data-wallet-variant="${variant}"]`)
            const typographyResult = await cdp.send('Runtime.evaluate', {
                expression: `(() => {
                    const candidate = document.querySelector('[data-wallet-variant="${variant}"]')
                    const hero = candidate?.querySelector('[aria-label$="코드"]')
                    return {
                        variant: candidate?.dataset.walletVariant ?? null,
                        fontSize: hero ? getComputedStyle(hero).fontSize : null,
                    }
                })()`,
                returnByValue: true,
            })
            const typography = typographyResult.result.value
            if (
                typography.variant !== variant ||
                typography.fontSize !== expectedFontSize
            ) {
                console.error(
                    `[workbench] ${viewport.width}px ${variant} wallet typography guard 실패`,
                )
                console.error(JSON.stringify(typography, null, 2))
                process.exitCode = 1
            } else {
                console.log(
                    `[workbench] ${viewport.width}px ${variant} hero ${typography.fontSize}`,
                )
            }
        }

        for (const textZoom of [100, 200]) {
            await cdp.send('Page.navigate', { url: walletPageUrl })
            await waitForScenario(cdp, '[data-testid=wallet-balance-scenario]')
            await cdp.send('Runtime.evaluate', {
                expression: `document.documentElement.style.fontSize = '${textZoom}%'`,
            })
            await delay(50)
            const walletResult = await cdp.send('Runtime.evaluate', {
                expression: walletLayoutAuditExpression(viewport.mobile),
                returnByValue: true,
            })
            const walletAudit = walletResult.result.value
            if (
                !walletAudit.documentFits ||
                !walletAudit.scenarioFits ||
                !walletAudit.amountsFit ||
                !walletAudit.controlsFit ||
                walletAudit.hasHorizontalScroller ||
                walletAudit.studyColumns !== (viewport.mobile ? 1 : 2) ||
                walletAudit.metricColumns !== (viewport.mobile ? 1 : 3)
            ) {
                console.error(
                    `[workbench] ${viewport.width}px/${textZoom}% wallet layout guard 실패`,
                )
                console.error(JSON.stringify(walletAudit, null, 2))
                process.exitCode = 1
            } else {
                console.log(
                    `[workbench] ${viewport.width}px/${textZoom}% wallet overflow 0건 columns ${walletAudit.studyColumns}/${walletAudit.metricColumns}`,
                )
            }
        }

        const navigationVariants = [
            'fc-nav-contact-dock',
            'fc-nav-transition-dock',
            'fc-nav-compact-dock',
            'fc-nav-direction-dock',
        ]
        const navigationSnapshots = new Map()
        for (const variant of navigationVariants) {
            await cdp.send('Page.navigate', {
                url: `${navigationPageUrl}?variant=${variant}`,
            })
            await waitForScenario(
                cdp,
                '[data-testid=navigation-layout-scenario]',
            )
            await waitForScenario(cdp, '[data-workbench-nav-measure]')
            const beforeResult = await cdp.send('Runtime.evaluate', {
                expression: navigationAuditExpression(viewport.mobile),
                returnByValue: true,
            })
            const before = beforeResult.result.value
            let dropdown = null
            if (variant === 'fc-nav-contact-dock') {
                await cdp.send('Runtime.evaluate', {
                    expression:
                        'document.querySelector(\'button[aria-haspopup="menu"]\').click()',
                })
                await delay(100)
                const dropdownResult = await cdp.send('Runtime.evaluate', {
                    expression: navigationAuditExpression(viewport.mobile),
                    returnByValue: true,
                })
                dropdown = dropdownResult.result.value
                await cdp.send('Runtime.evaluate', {
                    expression:
                        'document.querySelector(\'button[aria-haspopup="menu"]\').click()',
                })
                await delay(100)
            }
            await cdp.send('Runtime.evaluate', {
                expression:
                    variant === 'fc-nav-contact-dock'
                        ? "window.scrollTo(0, window.scrollY + document.querySelector('[data-workbench-dock-sentinel]').getBoundingClientRect().bottom + 1)"
                        : "window.scrollTo(0, window.scrollY + document.querySelector('[data-workbench-dock-sentinel]').getBoundingClientRect().top)",
            })
            await delay(100)
            const thresholdResult = await cdp.send('Runtime.evaluate', {
                expression: navigationAuditExpression(viewport.mobile),
                returnByValue: true,
            })
            const threshold = thresholdResult.result.value
            await cdp.send('Runtime.evaluate', {
                expression: 'window.scrollTo(0, window.scrollY + 480)',
            })
            await delay(100)
            const afterResult = await cdp.send('Runtime.evaluate', {
                expression: navigationAuditExpression(viewport.mobile),
                returnByValue: true,
            })
            const after = afterResult.result.value
            let upward = null
            if (variant === 'fc-nav-direction-dock') {
                await cdp.send('Runtime.evaluate', {
                    expression: 'window.scrollTo(0, window.scrollY - 160)',
                })
                await delay(100)
                const upwardResult = await cdp.send('Runtime.evaluate', {
                    expression: navigationAuditExpression(viewport.mobile),
                    returnByValue: true,
                })
                upward = upwardResult.result.value
            }
            if (process.env.WORKBENCH_LAYOUT_DEBUG === '1') {
                console.log(
                    JSON.stringify(
                        {
                            viewport,
                            variant,
                            before,
                            dropdown,
                            threshold,
                            after,
                            upward,
                        },
                        null,
                        2,
                    ),
                )
            }
            const audits = [before, threshold, after, upward].filter(Boolean)
            navigationSnapshots.set(variant, before)
            const selectedAtTop = variant === 'fc-nav-contact-dock'
            const selectedOffset = viewport.mobile ? 8 : 12
            const navigationFailed =
                (selectedAtTop
                    ? before.dockState !== 'flow' ||
                      before.navBounds.top !== selectedOffset ||
                      threshold.dockState !== 'stuck' ||
                      threshold.navBounds.top !== 0 ||
                      before.contentGap !== 0 ||
                      !before.radiusMatches ||
                      before.hasBacking ||
                      !before.surfaceDirectChildOfFrame ||
                      !before.bottomChildRadiusMatches ||
                      !before.bottomCornerSamplesTransparent ||
                      !dropdown?.dropdownUnclipped ||
                      !dropdown?.menuEscapesSurface
                    : before.dockState !== 'flow' ||
                      before.navBounds.top <= 0 ||
                      threshold.dockState !== 'stuck' ||
                      threshold.navBounds.top !== 0) ||
                after.dockState !== 'stuck' ||
                after.navBounds.top !== 0 ||
                (selectedAtTop &&
                    (!after.radiusMatches ||
                        after.hasBacking ||
                        !after.surfaceDirectChildOfFrame ||
                        !after.bottomChildRadiusMatches ||
                        !after.bottomCornerSamplesTransparent)) ||
                before.frameHeight !== after.frameHeight ||
                audits.some(
                    (entry) =>
                        !entry.documentFits ||
                        !entry.alignedExactly ||
                        !entry.contentAligned ||
                        (!selectedAtTop && !entry.dropdownUnclipped),
                ) ||
                (viewport.mobile
                    ? !after.safeArea || !after.mobileUsable
                    : after.desktopMenuCount === 0) ||
                (variant === 'fc-nav-contact-dock' &&
                    before.surfaceClassName !== after.surfaceClassName) ||
                (variant === 'fc-nav-transition-dock' &&
                    (!after.rounded || !after.shadowed)) ||
                (variant === 'fc-nav-compact-dock' && !after.compact) ||
                (variant === 'fc-nav-direction-dock' &&
                    (after.dockDirection !== 'minimized' ||
                        upward?.dockDirection !== 'expanded' ||
                        upward?.compact))
            if (navigationFailed) {
                console.error(
                    `[workbench] ${viewport.width}px ${variant} navigation layout guard 실패`,
                )
                console.error(
                    JSON.stringify(
                        { before, dropdown, threshold, after, upward },
                        null,
                        2,
                    ),
                )
                process.exitCode = 1
            } else {
                console.log(
                    `[workbench] ${viewport.width}px ${variant} top ${before.navBounds.top}→${threshold.navBounds.top}→${after.navBounds.top}px, gap ${before.contentGap}px, radius ${before.navRadius}/${before.contentRadius}, alignment ${after.delta.left}/${after.delta.right}/${after.delta.width}px`,
                )
            }
        }
        const contact = navigationSnapshots.get('fc-nav-contact-dock')
        for (const referenceVariant of [
            'fc-nav-compact-dock',
            'fc-nav-direction-dock',
        ]) {
            const reference = navigationSnapshots.get(referenceVariant)
            const sameSurrounding = Boolean(
                contact &&
                reference &&
                !contact.hasBacking &&
                !reference.hasBacking &&
                contact.surfaceDirectChildOfFrame &&
                reference.surfaceDirectChildOfFrame &&
                contact.frameBackgroundColor ===
                    reference.frameBackgroundColor &&
                contact.surfaceBackgroundColor ===
                    reference.surfaceBackgroundColor &&
                contact.cornerSurroundingColors.join('|') ===
                    reference.cornerSurroundingColors.join('|') &&
                contact.bottomCornerSurroundingColors.join('|') ===
                    reference.bottomCornerSurroundingColors.join('|'),
            )
            if (!sameSurrounding) {
                console.error(
                    `[workbench] ${viewport.width}px contact/${referenceVariant} corner surrounding guard 실패`,
                )
                console.error(JSON.stringify({ contact, reference }, null, 2))
                process.exitCode = 1
            }
        }

        await cdp.send('Page.navigate', {
            url: `http://127.0.0.1:${address.port}/market`,
        })
        await waitForScenario(cdp, '[data-app-navigation-surface]')
        const productionBefore = (
            await cdp.send('Runtime.evaluate', {
                expression: productionNavigationAuditExpression(),
                returnByValue: true,
            })
        ).result.value
        await cdp.send('Runtime.evaluate', {
            expression:
                'document.querySelector(\'button[aria-haspopup="menu"]\').click()',
        })
        await delay(100)
        const productionDropdown = (
            await cdp.send('Runtime.evaluate', {
                expression: productionNavigationAuditExpression(),
                returnByValue: true,
            })
        ).result.value
        await cdp.send('Runtime.evaluate', {
            expression:
                'document.querySelector(\'button[aria-haspopup="menu"]\').click()',
        })
        await cdp.send('Runtime.evaluate', {
            expression:
                "window.scrollTo(0, window.scrollY + document.querySelector('[data-app-navigation-sentinel]').getBoundingClientRect().bottom + 1)",
        })
        await delay(100)
        const productionThreshold = (
            await cdp.send('Runtime.evaluate', {
                expression: productionNavigationAuditExpression(),
                returnByValue: true,
            })
        ).result.value
        await cdp.send('Runtime.evaluate', {
            expression: 'window.scrollTo(0, window.scrollY + 480)',
        })
        await delay(100)
        const productionAfter = (
            await cdp.send('Runtime.evaluate', {
                expression: productionNavigationAuditExpression(),
                returnByValue: true,
            })
        ).result.value
        const expectedOffset = viewport.mobile ? 8 : 12
        const expectedRadius = viewport.mobile ? '12px' : '16px'
        const productionFailed =
            productionBefore.dockState !== 'flow' ||
            productionBefore.navBounds.top !== expectedOffset ||
            productionThreshold.dockState !== 'stuck' ||
            productionThreshold.navBounds.top !== 0 ||
            productionAfter.dockState !== 'stuck' ||
            productionAfter.navBounds.top !== 0 ||
            productionBefore.navRadius.some(
                (radius) => radius !== expectedRadius,
            ) ||
            productionAfter.navRadius.some(
                (radius) => radius !== expectedRadius,
            ) ||
            productionBefore.bottomOwnerRadius.some(
                (radius) => radius !== expectedRadius,
            ) ||
            productionAfter.bottomOwnerRadius.some(
                (radius) => radius !== expectedRadius,
            ) ||
            !productionBefore.bottomCornerSamplesTransparent ||
            !productionAfter.bottomCornerSamplesTransparent ||
            productionBefore.hasBacking ||
            productionBefore.frameBackgroundColor !== 'rgba(0, 0, 0, 0)' ||
            productionBefore.contentGap !== 0 ||
            productionBefore.frameHeight !== productionAfter.frameHeight ||
            !productionBefore.alignedExactly ||
            !productionAfter.alignedExactly ||
            !productionBefore.documentFits ||
            !productionAfter.documentFits ||
            !productionDropdown.dropdownUnclipped
        if (productionFailed) {
            console.error(
                `[production] ${viewport.width}px navigation layout guard 실패`,
            )
            console.error(
                JSON.stringify(
                    {
                        productionBefore,
                        productionDropdown,
                        productionThreshold,
                        productionAfter,
                    },
                    null,
                    2,
                ),
            )
            process.exitCode = 1
        } else {
            console.log(
                `[production] ${viewport.width}px navigation top ${productionBefore.navBounds.top}→${productionThreshold.navBounds.top}→${productionAfter.navBounds.top}px, gap ${productionBefore.contentGap}px, radius ${productionBefore.navRadius.join(' ')}, alignment ${productionAfter.delta.left}/${productionAfter.delta.right}/${productionAfter.delta.width}px`,
            )
        }

        await cdp.send('Runtime.evaluate', {
            expression: installPostDetailFixtureExpression(),
        })
        await cdp.send('Runtime.evaluate', {
            expression: `history.pushState({}, '', '/boards/community/P-1'); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0)`,
        })
        await waitForScenario(cdp, 'h1 > span')
        const postDetailAudit = (
            await cdp.send('Runtime.evaluate', {
                expression: postDetailAuditExpression(),
                returnByValue: true,
            })
        ).result.value
        if (
            !postDetailAudit.documentFits ||
            !postDetailAudit.layoutFillsContent ||
            !postDetailAudit.titleFits ||
            !postDetailAudit.proseFits ||
            !postDetailAudit.commentsFit ||
            !postDetailAudit.controlsFit
        ) {
            console.error(
                `[production] ${viewport.width}px post detail layout guard 실패`,
            )
            console.error(JSON.stringify(postDetailAudit, null, 2))
            process.exitCode = 1
        } else {
            console.log(
                `[production] ${viewport.width}px post detail alignment ${postDetailAudit.delta.left}/${postDetailAudit.delta.right}/${postDetailAudit.delta.width}px, overflow 0건`,
            )
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

function installPostDetailFixtureExpression() {
    return `(() => {
        const nativeFetch = window.fetch.bind(window)
        const longText = '공백없이아주긴게시글제목'.repeat(100)
        const response = (data) => Promise.resolve(new Response(
            JSON.stringify({ success: true, data, timestamp: '2026-08-13T00:00:00Z' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        ))
        window.fetch = (input, init) => {
            const requestUrl = typeof input === 'string' ? input : input.url
            const path = new URL(requestUrl, location.origin).pathname
            if (path.endsWith('/boards/community/posts/P-1')) {
                return response({
                    postPublicId: 'P-1', boardSlug: 'community', title: longText,
                    content: longText, authorNickname: '작성자', isPinned: true,
                    viewCount: 12, commentCount: 1, images: [],
                    createdAt: '2026-08-13T00:00:00Z',
                    updatedAt: '2026-08-13T00:00:00Z', editable: true,
                })
            }
            if (path.endsWith('/boards/community')) {
                return response({
                    slug: 'community', name: '커뮤니티', description: null,
                    boardType: 'GENERAL', writePolicy: 'AUTHENTICATED',
                    allowComments: true, sortOrder: 1,
                })
            }
            if (path.endsWith('/posts/P-1/comments')) {
                return response({
                    content: [{
                        commentPublicId: 'C-1', authorNickname: '댓글작성자',
                        content: '공백없는아주긴댓글'.repeat(120),
                        createdAt: '2026-08-13T00:00:00Z',
                        updatedAt: '2026-08-13T00:00:00Z', editable: false,
                        ownedByMe: false, likeCount: 0, dislikeCount: 0,
                        myReaction: null, deleted: false, replyCount: 0,
                    }],
                    page: 0, size: 20, totalElements: 1, totalPages: 1,
                })
            }
            return nativeFetch(input, init)
        }
    })()`
}

function postDetailAuditExpression() {
    return `(() => {
        const documentElement = document.documentElement
        const view = document.querySelector('#view')
        const layout = view?.firstElementChild
        const title = layout?.querySelector('h1 > span')
        const prose = layout?.querySelector('article > div.whitespace-pre-wrap')
        const comment = layout?.querySelector('section[aria-label="댓글"] li p.break-words')
        const viewStyle = view ? getComputedStyle(view) : null
        const viewBounds = view?.getBoundingClientRect()
        const layoutBounds = layout?.getBoundingClientRect()
        const contentBounds = viewBounds && viewStyle ? {
            left: viewBounds.left + parseFloat(viewStyle.paddingLeft),
            right: viewBounds.right - parseFloat(viewStyle.paddingRight),
            width: viewBounds.width - parseFloat(viewStyle.paddingLeft) - parseFloat(viewStyle.paddingRight),
        } : null
        const delta = contentBounds && layoutBounds ? {
            left: Math.abs(contentBounds.left - layoutBounds.left),
            right: Math.abs(contentBounds.right - layoutBounds.right),
            width: Math.abs(contentBounds.width - layoutBounds.width),
        } : { left: null, right: null, width: null }
        const fits = (element) => Boolean(
            element && element.scrollWidth <= element.clientWidth
        )
        const controls = layout ? [...layout.querySelectorAll('button, a')] : []
        return {
            documentFits: documentElement.scrollWidth <= documentElement.clientWidth,
            layoutFillsContent: Boolean(
                delta.left < 0.01 && delta.right < 0.01 && delta.width < 0.01
            ),
            titleFits: fits(title),
            proseFits: fits(prose),
            commentsFit: fits(comment),
            controlsFit: Boolean(
                layoutBounds && controls.length > 0 && controls.every((control) => {
                    const rect = control.getBoundingClientRect()
                    return rect.left >= layoutBounds.left - 0.01 &&
                        rect.right <= layoutBounds.right + 0.01
                })
            ),
            delta,
            widths: {
                document: [documentElement.scrollWidth, documentElement.clientWidth],
                title: title ? [title.scrollWidth, title.clientWidth] : null,
                prose: prose ? [prose.scrollWidth, prose.clientWidth] : null,
                comment: comment ? [comment.scrollWidth, comment.clientWidth] : null,
            },
        }
    })()`
}

function productionNavigationAuditExpression() {
    return `(() => {
        const documentElement = document.documentElement
        const frame = document.querySelector('[data-app-navigation-frame]')
        const surface = document.querySelector('[data-app-navigation-surface]')
        const content = document.querySelector('[data-testid="app-content-plane"]')
        const footer = document.querySelector('[data-app-footer-surface]')
        const menu = surface?.querySelector('[role="menu"]')
        const header = surface?.querySelector('header')
        const horizontalNav = surface?.querySelector('nav[aria-label="주요 메뉴"]')
        const bounds = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return {
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
                height: Math.round(rect.height * 100) / 100,
                top: Math.round(rect.top * 100) / 100,
                bottom: Math.round(rect.bottom * 100) / 100,
            }
        }
        const navBounds = bounds(surface)
        const contentBounds = bounds(content)
        const footerBounds = bounds(footer)
        const delta = navBounds && contentBounds && footerBounds
            ? {
                  left: Math.max(
                      Math.abs(navBounds.left - contentBounds.left),
                      Math.abs(navBounds.left - footerBounds.left),
                  ),
                  right: Math.max(
                      Math.abs(navBounds.right - contentBounds.right),
                      Math.abs(navBounds.right - footerBounds.right),
                  ),
                  width: Math.max(
                      Math.abs(navBounds.width - contentBounds.width),
                      Math.abs(navBounds.width - footerBounds.width),
                  ),
              }
            : null
        const surfaceStyle = surface ? getComputedStyle(surface) : null
        const frameStyle = frame ? getComputedStyle(frame) : null
        const horizontalStyle = horizontalNav ? getComputedStyle(horizontalNav) : null
        const bottomOwner = !horizontalNav || horizontalStyle?.display === 'none'
            ? header
            : horizontalNav
        const bottomOwnerStyle = bottomOwner ? getComputedStyle(bottomOwner) : null
        const bottomCornerElements = navBounds
            ? [
                  document.elementFromPoint(navBounds.left + 2, navBounds.bottom - 2),
                  document.elementFromPoint(navBounds.right - 2, navBounds.bottom - 2),
              ]
            : []
        return {
            documentFits: documentElement.scrollWidth <= documentElement.clientWidth,
            dockState: frame?.dataset.dockState,
            navBounds,
            contentBounds,
            footerBounds,
            frameHeight: bounds(frame)?.height,
            contentGap: navBounds && contentBounds
                ? Math.round((contentBounds.top - navBounds.bottom) * 100) / 100
                : null,
            delta,
            alignedExactly: Boolean(
                delta && delta.left === 0 && delta.right === 0 && delta.width === 0
            ),
            navRadius: surfaceStyle
                ? [
                      surfaceStyle.borderTopLeftRadius,
                      surfaceStyle.borderTopRightRadius,
                      surfaceStyle.borderBottomRightRadius,
                      surfaceStyle.borderBottomLeftRadius,
                  ]
                : [],
            bottomOwnerRadius: bottomOwnerStyle
                ? [
                      bottomOwnerStyle.borderBottomLeftRadius,
                      bottomOwnerStyle.borderBottomRightRadius,
                  ]
                : [],
            bottomCornerSamplesTransparent: Boolean(
                bottomCornerElements.length === 2 &&
                bottomCornerElements.every(
                    (element) =>
                        element &&
                        getComputedStyle(element).backgroundColor ===
                            'rgba(0, 0, 0, 0)'
                )
            ),
            bottomCornerColors: bottomCornerElements.map((element) =>
                element ? getComputedStyle(element).backgroundColor : null
            ),
            hasBacking: Boolean(document.querySelector('[data-app-navigation-backing]')),
            frameBackgroundColor: frameStyle?.backgroundColor ?? null,
            dropdownUnclipped: Boolean(
                menu &&
                surfaceStyle?.overflowX === 'visible' &&
                surfaceStyle?.overflowY === 'visible'
            ),
        }
    })()`
}

function navigationAuditExpression(mobile) {
    return `(() => {
        const documentElement = document.documentElement
        const mobileNav = document.querySelector('nav.fixed.inset-x-0')
        const frame = document.querySelector('[data-workbench-navigation-frame]')
        const sentinel = document.querySelector('[data-workbench-dock-sentinel]')
        const navTarget = document.querySelector('[data-workbench-nav-measure]')
        const footerTarget = document.querySelector('[data-workbench-footer-measure]')
        const contentTarget = document.querySelector('[data-workbench-content-measure]')
        const bounds = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return {
                left: Math.round(rect.left * 100) / 100,
                right: Math.round(rect.right * 100) / 100,
                width: Math.round(rect.width * 100) / 100,
                height: Math.round(rect.height * 100) / 100,
                top: Math.round(rect.top * 100) / 100,
                bottom: Math.round(rect.bottom * 100) / 100,
            }
        }
        const navBounds = bounds(navTarget)
        const footerBounds = bounds(footerTarget)
        const contentBounds = bounds(contentTarget)
        const delta = navBounds && footerBounds
            ? {
                  left: Math.abs(navBounds.left - footerBounds.left),
                  right: Math.abs(navBounds.right - footerBounds.right),
                  width: Math.abs(navBounds.width - footerBounds.width),
              }
            : null
        const contentDelta = navBounds && contentBounds
            ? {
                  left: Math.abs(navBounds.left - contentBounds.left),
                  right: Math.abs(navBounds.right - contentBounds.right),
                  width: Math.abs(navBounds.width - contentBounds.width),
              }
            : null
        const mobileBounds = bounds(mobileNav)
        const frameBounds = bounds(frame)
        const expectedRadius = '${mobile ? '12px' : '16px'}'
        const header = navTarget?.querySelector('header')
        const horizontalNav = navTarget?.querySelector('nav[aria-label="주요 메뉴"]')
        const frameStyle = frame ? getComputedStyle(frame) : null
        const surfaceStyle = navTarget ? getComputedStyle(navTarget) : null
        const horizontalStyle = horizontalNav ? getComputedStyle(horizontalNav) : null
        const bottomOwner = !horizontalNav || horizontalStyle?.display === 'none'
            ? header
            : horizontalNav
        const bottomOwnerStyle = bottomOwner ? getComputedStyle(bottomOwner) : null
        const contentStyle = contentTarget ? getComputedStyle(contentTarget) : null
        const menu = navTarget?.querySelector('[role="menu"]')
        const menuBounds = bounds(menu)
        const cornerElements = navBounds
            ? [
                  document.elementFromPoint(navBounds.left + 2, navBounds.top + 2),
                  document.elementFromPoint(navBounds.right - 2, navBounds.top + 2),
              ]
            : []
        const cornerColors = cornerElements.map((element) =>
            element ? getComputedStyle(element).backgroundColor : null
        )
        const cornerSurroundingColors = cornerElements.map((element) => {
            const surrounding = element === navTarget || navTarget?.contains(element)
                ? frame
                : element
            return surrounding ? getComputedStyle(surrounding).backgroundColor : null
        })
        const bottomCornerElements = navBounds
            ? [
                  document.elementFromPoint(navBounds.left + 2, navBounds.bottom - 2),
                  document.elementFromPoint(navBounds.right - 2, navBounds.bottom - 2),
              ]
            : []
        const bottomCornerColors = bottomCornerElements.map((element) =>
            element ? getComputedStyle(element).backgroundColor : null
        )
        const bottomCornerSurroundingColors = bottomCornerElements.map((element) => {
            const surrounding = element === navTarget || navTarget?.contains(element)
                ? frame
                : element
            return surrounding ? getComputedStyle(surrounding).backgroundColor : null
        })
        const mobileItems = mobileNav
            ? [...mobileNav.children].map(bounds).filter(Boolean)
            : []
        return {
            documentFits: documentElement.scrollWidth <= documentElement.clientWidth,
            navBounds,
            footerBounds,
            contentBounds,
            delta,
            contentDelta,
            contentGap: navBounds && contentBounds
                ? Math.round((contentBounds.top - (navBounds.top + navBounds.height)) * 100) / 100
                : null,
            aligned: Boolean(delta && delta.left <= 1 && delta.right <= 1 && delta.width <= 1),
            alignedExactly: Boolean(delta && delta.left === 0 && delta.right === 0 && delta.width === 0),
            contentAligned: Boolean(contentDelta && contentDelta.left === 0 && contentDelta.right === 0 && contentDelta.width === 0),
            dockState:
                frame?.dataset.workbenchDockState ?? frame?.dataset.dockState,
            dockDirection: frame?.dataset.workbenchDockDirection,
            sentinelTop: bounds(sentinel)?.top,
            frameHeight: frameBounds?.height,
            surfaceClassName: String(navTarget?.className ?? ''),
            navRadius: surfaceStyle
                ? [surfaceStyle.borderTopLeftRadius, surfaceStyle.borderTopRightRadius, surfaceStyle.borderBottomRightRadius, surfaceStyle.borderBottomLeftRadius].join(' ')
                : null,
            contentRadius: contentStyle
                ? [contentStyle.borderTopLeftRadius, contentStyle.borderTopRightRadius, contentStyle.borderBottomRightRadius, contentStyle.borderBottomLeftRadius].join(' ')
                : null,
            radiusMatches: Boolean(
                surfaceStyle &&
                surfaceStyle.borderTopLeftRadius === expectedRadius &&
                surfaceStyle.borderTopRightRadius === expectedRadius &&
                surfaceStyle.borderBottomLeftRadius === expectedRadius &&
                surfaceStyle.borderBottomRightRadius === expectedRadius
            ),
            bottomChildRadiusMatches: Boolean(
                bottomOwnerStyle &&
                bottomOwnerStyle.borderBottomLeftRadius === expectedRadius &&
                bottomOwnerStyle.borderBottomRightRadius === expectedRadius
            ),
            bottomCornerSamplesTransparent: Boolean(
                bottomCornerElements.length === 2 &&
                bottomCornerElements.every(
                    (element) =>
                        element &&
                        getComputedStyle(element).backgroundColor ===
                            'rgba(0, 0, 0, 0)'
                )
            ),
            hasBacking: Boolean(
                document.querySelector('[data-workbench-nav-backing]')
            ),
            surfaceDirectChildOfFrame: navTarget?.parentElement === frame,
            frameBackgroundColor: frameStyle?.backgroundColor ?? null,
            surfaceBackgroundColor: surfaceStyle?.backgroundColor ?? null,
            cornerColors,
            cornerSurroundingColors,
            bottomCornerColors,
            bottomCornerSurroundingColors,
            rounded: Boolean(navTarget?.classList.contains('rounded-xl')),
            shadowed: Boolean(navTarget?.classList.contains('shadow-sm')),
            compact: Boolean(header?.classList.contains('h-12')),
            dropdownUnclipped: Boolean(
                surfaceStyle &&
                surfaceStyle.overflowX === 'visible' &&
                surfaceStyle.overflowY === 'visible'
            ),
            menuBounds,
            menuEscapesSurface: Boolean(
                menuBounds && navBounds && menuBounds.bottom > navBounds.top + navBounds.height
            ),
            scrollY: window.scrollY,
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

function walletLayoutAuditExpression(mobile) {
    return `(() => {
        const documentElement = document.documentElement
        const scenario = document.querySelector('[data-testid="wallet-balance-scenario"]')
        const study = document.querySelector('[data-testid="wallet-study-layout"]')
        const candidate = document.querySelector('[data-wallet-variant]')
        const metrics = candidate?.querySelector('[data-wallet-metrics]')
        const amounts = candidate ? [...candidate.querySelectorAll('[aria-label$="코드"]')] : []
        const controls = scenario ? [...scenario.querySelectorAll('a, button')] : []
        const bounds = (element) => {
            if (!element) return null
            const rect = element.getBoundingClientRect()
            return { left: rect.left, right: rect.right, width: rect.width }
        }
        const scenarioBounds = bounds(scenario)
        const gridColumns = (element) => {
            if (!element) return 0
            return getComputedStyle(element).gridTemplateColumns
                .split(' ')
                .filter(Boolean).length
        }
        return {
            documentFits: documentElement.scrollWidth <= documentElement.clientWidth,
            scenarioFits: Boolean(
                scenario &&
                scenario.scrollWidth <= scenario.clientWidth + 1 &&
                candidate &&
                candidate.scrollWidth <= candidate.clientWidth + 1
            ),
            amountsFit: Boolean(
                amounts.length === 4 && amounts.every((amount) => {
                    const amountBounds = bounds(amount)
                    const textBounds = bounds(amount.lastElementChild)
                    const candidateBounds = bounds(candidate)
                    return amountBounds && textBounds && candidateBounds &&
                        getComputedStyle(amount).wordBreak === 'break-all' &&
                        amountBounds.left >= candidateBounds.left - 1 &&
                        amountBounds.right <= candidateBounds.right + 1 &&
                        textBounds.left >= candidateBounds.left - 1 &&
                        textBounds.right <= candidateBounds.right + 1
                })
            ),
            controlsFit: Boolean(
                scenarioBounds && controls.length > 0 && controls.every((control) => {
                    const controlBounds = bounds(control)
                    return controlBounds &&
                        controlBounds.left >= scenarioBounds.left - 1 &&
                        controlBounds.right <= scenarioBounds.right + 1
                })
            ),
            hasHorizontalScroller: Boolean(
                scenario && [...scenario.querySelectorAll('*')].some(
                    (element) => getComputedStyle(element).overflowX === 'auto'
                )
            ),
            studyColumns: gridColumns(study),
            metricColumns: gridColumns(metrics),
            expectedMobile: ${mobile},
            widths: {
                document: [documentElement.scrollWidth, documentElement.clientWidth],
                scenario: scenario ? [scenario.scrollWidth, scenario.clientWidth] : null,
                candidate: candidate ? [candidate.scrollWidth, candidate.clientWidth] : null,
                amounts: amounts.map((amount) => [amount.scrollWidth, amount.clientWidth]),
            },
        }
    })()`
}
