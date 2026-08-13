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
    const headerInner = header?.firstElementChild as HTMLElement | null
    const navigationInner = horizontalNav?.firstElementChild as HTMLElement | null
    const footerInner = footer?.firstElementChild as HTMLElement | null

    if (
        !shellColumn ||
        !header ||
        !horizontalNav ||
        !footer ||
        !headerInner ||
        !navigationInner ||
        !footerInner
    ) {
        return () => undefined
    }

    const originalClasses = new Map<HTMLElement, string>(
        [
            header,
            horizontalNav,
            footer,
            headerInner,
            navigationInner,
            footerInner,
        ].map((element) => [element, element.className]),
    )
    const frame = document.createElement('div')
    frame.dataset.workbenchNavigationFrame = variant
    frame.classList.add('sticky', 'top-0', 'z-30')

    header.classList.remove('sticky', 'top-0', 'z-30')
    horizontalNav.classList.remove('sticky', 'top-16', 'z-20', 'border-b')
    headerInner.classList.remove('px-4')
    navigationInner.classList.remove('px-6')
    headerInner.classList.add('px-5', 'sm:px-8', 'xl:px-10')
    navigationInner.classList.add('px-5', 'sm:px-8', 'xl:px-10')

    let measureTarget: HTMLElement
    if (variant === NAVIGATION_LAYOUT_VARIANTS.floating) {
        frame.classList.add('space-y-2', 'p-4')
        footer.classList.add('px-4')
        for (const surface of [header, horizontalNav]) {
            surface.classList.add(
                'mx-auto',
                'w-full',
                'max-w-[1440px]',
                'rounded-2xl',
                'border',
                'border-chrome-selected',
                'shadow-lg',
            )
            frame.append(surface)
        }
        measureTarget = header
    } else {
        const surface = document.createElement('div')
        surface.classList.add(
            'app-chrome',
            'mx-auto',
            'w-full',
            'max-w-[1440px]',
            'border',
            'border-chrome-selected',
            'bg-chrome',
        )
        if (variant === NAVIGATION_LAYOUT_VARIANTS.balanced) {
            frame.classList.add('p-3')
            footer.classList.add('px-3')
            surface.classList.add('rounded-xl', 'shadow-sm')
            header.classList.add('rounded-xl')
            horizontalNav.classList.add('rounded-xl')
        } else {
            frame.classList.add('p-2')
            footer.classList.add('px-2')
            surface.classList.add('rounded-lg')
            header.classList.add('rounded-lg')
            horizontalNav.classList.add('rounded-lg')
        }
        surface.append(header, horizontalNav)
        frame.append(surface)
        measureTarget = surface
    }

    measureTarget.dataset.workbenchNavMeasure = variant
    footerInner.dataset.workbenchFooterMeasure = variant
    shellColumn.insertBefore(frame, view)

    return () => {
        shellColumn.insertBefore(header, frame)
        shellColumn.insertBefore(horizontalNav, frame)
        frame.remove()
        for (const [element, className] of originalClasses) {
            element.className = className
        }
        delete measureTarget.dataset.workbenchNavMeasure
        delete footerInner.dataset.workbenchFooterMeasure
    }
}
