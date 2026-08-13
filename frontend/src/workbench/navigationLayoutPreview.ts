import { NAVIGATION_LAYOUT_VARIANTS } from './scenarioMetadata'
import type { NavigationLayoutVariantId } from './scenarioMetadata'

export function installNavigationLayoutPreview(
    scenario: HTMLElement,
    variant: NavigationLayoutVariantId,
) {
    const view = scenario.closest<HTMLElement>('#view')
    const shellColumn = view?.parentElement
    const header = shellColumn?.querySelector<HTMLElement>(':scope > header')
    const horizontalNav = shellColumn?.querySelector<HTMLElement>(
        ':scope > nav.app-chrome',
    )
    const footer = shellColumn?.querySelector<HTMLElement>(':scope > footer')
    const contentPlane = view?.querySelector<HTMLElement>(
        '[data-testid="app-content-plane"]',
    )
    const headerInner = header?.firstElementChild as HTMLElement | null
    const navigationInner = horizontalNav?.firstElementChild as HTMLElement | null
    const footerInner = footer?.firstElementChild as HTMLElement | null
    const contactDock = variant === NAVIGATION_LAYOUT_VARIANTS.contactDock
    const desktopOffset = window.matchMedia('(min-width: 1280px)')

    if (
        !view ||
        !shellColumn ||
        !header ||
        !footer ||
        !contentPlane ||
        !headerInner ||
        !footerInner
    ) {
        return () => undefined
    }

    const auxiliaries = Array.from(
        headerInner.querySelectorAll<HTMLElement>(
            '.sm\\:block, .sm\\:flex, .lg\\:flex',
        ),
    ).filter((element): element is HTMLElement => element instanceof HTMLElement)
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

    header.classList.remove('sticky', 'top-0', 'z-30', 'border-b')
    horizontalNav?.classList.remove('sticky', 'top-16', 'z-20', 'border-b')
    headerInner.classList.remove('px-4')
    navigationInner?.classList.remove('px-6')
    headerInner.classList.add('px-5', 'sm:px-8', 'xl:px-10')
    navigationInner?.classList.add('px-5', 'sm:px-8', 'xl:px-10')
    footer.classList.add('px-3', 'sm:px-5', 'xl:px-8')
    header.classList.add('rounded-xl')
    horizontalNav?.classList.add('rounded-xl')
    let releaseSelectedOffset: () => void = () => undefined

    surface.classList.add('transition-all', 'motion-reduce:transition-none')
    if (variant === NAVIGATION_LAYOUT_VARIANTS.contactDock) {
        frame.classList.add('px-3', 'sm:px-5', 'xl:px-8')
        view.classList.remove('py-4', 'sm:py-5', 'xl:py-7')
        view.classList.add('pb-4')
        const contentRadius = getComputedStyle(contentPlane)
        const applySelectedOffset = () => {
            const offset = desktopOffset.matches ? '12px' : '8px'
            const mobileRadius = '12px'
            frame.style.top =
                frame.dataset.workbenchDockState === 'stuck' ? '0px' : offset
            sentinel.style.height = offset
            surface.style.borderTopLeftRadius = desktopOffset.matches
                ? contentRadius.borderTopLeftRadius
                : mobileRadius
            surface.style.borderTopRightRadius = desktopOffset.matches
                ? contentRadius.borderTopRightRadius
                : mobileRadius
            surface.style.borderBottomLeftRadius = desktopOffset.matches
                ? contentRadius.borderBottomLeftRadius
                : mobileRadius
            surface.style.borderBottomRightRadius = desktopOffset.matches
                ? contentRadius.borderBottomRightRadius
                : mobileRadius
        }
        applySelectedOffset()
        desktopOffset.addEventListener('change', applySelectedOffset)
        releaseSelectedOffset = () =>
            desktopOffset.removeEventListener('change', applySelectedOffset)
    }
    if (variant !== NAVIGATION_LAYOUT_VARIANTS.transitionDock) {
        surface.classList.add('rounded-xl')
    }
    if (
        variant === NAVIGATION_LAYOUT_VARIANTS.contactDock ||
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
    if (contactDock) {
        shellColumn.insertBefore(sentinel, view)
        shellColumn.insertBefore(frame, view)
    } else {
        view.insertBefore(sentinel, contentPlane)
        view.insertBefore(frame, contentPlane)
    }

    let previousScrollY = window.scrollY
    let scrollingDown = false
    let animationFrame = 0

    const restoreAuxiliaries = () => {
        for (const element of auxiliaries) {
            element.className = originalClasses.get(element) ?? element.className
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
        const scrollY = window.scrollY
        const sentinelBounds = sentinel.getBoundingClientRect()
        const stuck = contactDock
            ? window.scrollY > 0 && sentinelBounds.bottom <= 0
            : sentinelBounds.top <= 0
        frame.dataset.workbenchDockState = stuck ? 'stuck' : 'flow'
        if (contactDock) {
            frame.style.top = stuck
                ? '0px'
                : desktopOffset.matches
                  ? '12px'
                  : '8px'
        }

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
        releaseSelectedOffset()
        cancelAnimationFrame(animationFrame)
        shellColumn.insertBefore(header, view)
        if (horizontalNav) shellColumn.insertBefore(horizontalNav, view)
        sentinel.remove()
        frame.remove()
        for (const [element, className] of originalClasses) {
            element.className = className
        }
        delete footerInner.dataset.workbenchFooterMeasure
        delete contentPlane.dataset.workbenchContentMeasure
    }
}
