import { NAVIGATION_LAYOUT_VARIANTS } from './scenarioMetadata'
import type { NavigationLayoutVariantId } from './scenarioMetadata'

export function installNavigationLayoutPreview(
    scenario: HTMLElement,
    variant: NavigationLayoutVariantId,
) {
    const view = scenario.closest<HTMLElement>('#view')
    const shellColumn = view?.parentElement
    const productionFrame = shellColumn?.querySelector<HTMLElement>(
        '[data-app-navigation-frame]',
    )
    const productionSurface = productionFrame?.querySelector<HTMLElement>(
        '[data-app-navigation-surface]',
    )
    const productionSentinel = shellColumn?.querySelector<HTMLElement>(
        '[data-app-navigation-sentinel]',
    )
    const header = productionSurface?.querySelector<HTMLElement>('header')
    const horizontalNav =
        productionSurface?.querySelector<HTMLElement>('nav.app-chrome')
    const footer = shellColumn?.querySelector<HTMLElement>(':scope > footer')
    const contentPlane = view?.querySelector<HTMLElement>(
        '[data-testid="app-content-plane"]',
    )
    const headerInner = header?.firstElementChild as HTMLElement | null
    const navigationInner =
        horizontalNav?.firstElementChild as HTMLElement | null
    const footerInner = footer?.querySelector<HTMLElement>(
        '[data-app-footer-surface]',
    )
    const contactDock = variant === NAVIGATION_LAYOUT_VARIANTS.contactDock

    if (
        !view ||
        !shellColumn ||
        !header ||
        !footer ||
        !contentPlane ||
        !headerInner ||
        !footerInner ||
        !productionFrame ||
        !productionSurface ||
        !productionSentinel
    ) {
        return () => undefined
    }

    if (contactDock) {
        productionSentinel.dataset.workbenchDockSentinel = variant
        productionFrame.dataset.workbenchNavigationFrame = variant
        productionSurface.dataset.workbenchNavMeasure = variant
        footerInner.dataset.workbenchFooterMeasure = variant
        contentPlane.dataset.workbenchContentMeasure = variant
        return () => {
            delete productionSentinel.dataset.workbenchDockSentinel
            delete productionFrame.dataset.workbenchNavigationFrame
            delete productionSurface.dataset.workbenchNavMeasure
            delete footerInner.dataset.workbenchFooterMeasure
            delete contentPlane.dataset.workbenchContentMeasure
        }
    }

    const auxiliaries = Array.from(
        headerInner.querySelectorAll<HTMLElement>(
            '.sm\\:block, .sm\\:flex, .lg\\:flex',
        ),
    ).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
    )
    const originalClasses = new Map<HTMLElement, string>(
        [
            header,
            horizontalNav,
            footer,
            view,
            contentPlane,
            headerInner,
            navigationInner,
            footerInner,
            productionFrame,
            productionSentinel,
            ...auxiliaries,
        ]
            .filter((element): element is HTMLElement => element != null)
            .map((element) => [element, element.className]),
    )
    const sentinel = document.createElement('div')
    const frame = document.createElement('div')
    const surface = document.createElement('div')
    const compactSpacer = document.createElement('div')

    sentinel.dataset.workbenchDockSentinel = variant
    frame.dataset.workbenchNavigationFrame = variant
    frame.dataset.workbenchDockState = 'flow'
    frame.dataset.workbenchDockDirection = 'expanded'
    frame.classList.add('sticky', 'top-0', 'z-30')
    surface.dataset.workbenchNavMeasure = variant
    surface.classList.add(
        'app-chrome',
        'mx-auto',
        'w-full',
        'max-w-[1440px]',
        'border',
        'border-chrome-selected',
        'bg-chrome',
    )
    compactSpacer.classList.add('hidden', 'h-4')
    productionFrame.classList.add('hidden')
    productionSentinel.classList.add('hidden')
    view.classList.add('pt-4')

    header.classList.remove('sticky', 'top-0', 'z-30', 'border-b')
    horizontalNav?.classList.remove('sticky', 'top-16', 'z-20', 'border-b')
    headerInner.classList.remove('px-4')
    navigationInner?.classList.remove('px-6')
    headerInner.classList.add('px-5', 'sm:px-8', 'xl:px-10')
    navigationInner?.classList.add('px-5', 'sm:px-8', 'xl:px-10')
    footer.classList.add('px-3', 'sm:px-5', 'xl:px-8')
    header.classList.add('rounded-xl')
    horizontalNav?.classList.add('rounded-xl')
    surface.classList.add('transition-all', 'motion-reduce:transition-none')
    if (variant !== NAVIGATION_LAYOUT_VARIANTS.transitionDock) {
        surface.classList.add('rounded-xl')
    }
    if (
        variant === NAVIGATION_LAYOUT_VARIANTS.compactDock ||
        variant === NAVIGATION_LAYOUT_VARIANTS.directionDock
    ) {
        surface.classList.add('shadow-sm')
    }

    surface.append(header)
    if (horizontalNav) surface.append(horizontalNav)
    frame.append(surface, compactSpacer)
    footerInner.dataset.workbenchFooterMeasure = variant
    contentPlane.dataset.workbenchContentMeasure = variant
    view.insertBefore(sentinel, contentPlane)
    view.insertBefore(frame, contentPlane)

    let previousScrollY = window.scrollY
    let scrollingDown = false
    let animationFrame = 0

    const restoreAuxiliaries = () => {
        for (const element of auxiliaries) {
            element.className =
                originalClasses.get(element) ?? element.className
        }
    }
    const setCompact = (compact: boolean) => {
        header.classList.toggle('h-12', compact)
        header.classList.toggle('h-16', !compact)
        compactSpacer.classList.toggle('hidden', !compact)
        if (compact) {
            for (const element of auxiliaries) element.classList.add('hidden')
        } else {
            restoreAuxiliaries()
        }
    }
    const update = () => {
        animationFrame = 0
        const stuck = sentinel.getBoundingClientRect().top <= 0
        frame.dataset.workbenchDockState = stuck ? 'stuck' : 'flow'

        if (variant === NAVIGATION_LAYOUT_VARIANTS.transitionDock) {
            surface.classList.toggle('rounded-xl', stuck)
            surface.classList.toggle('shadow-sm', stuck)
        } else if (variant === NAVIGATION_LAYOUT_VARIANTS.compactDock) {
            setCompact(stuck)
        } else if (variant === NAVIGATION_LAYOUT_VARIANTS.directionDock) {
            const minimized = stuck && scrollingDown
            if (!stuck || !scrollingDown) {
                frame.dataset.workbenchDockDirection = 'expanded'
                setCompact(false)
            } else if (minimized) {
                frame.dataset.workbenchDockDirection = 'minimized'
                setCompact(true)
            }
        }
    }
    const onScroll = () => {
        const scrollY = window.scrollY
        if (Math.abs(scrollY - previousScrollY) >= 8) {
            scrollingDown = scrollY > previousScrollY
            previousScrollY = scrollY
        }
        if (animationFrame !== 0) return
        animationFrame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
        window.removeEventListener('scroll', onScroll)
        cancelAnimationFrame(animationFrame)
        productionSurface.append(header)
        if (horizontalNav) productionSurface.append(horizontalNav)
        sentinel.remove()
        frame.remove()
        for (const [element, className] of originalClasses) {
            element.className = className
        }
        delete footerInner.dataset.workbenchFooterMeasure
        delete contentPlane.dataset.workbenchContentMeasure
    }
}
