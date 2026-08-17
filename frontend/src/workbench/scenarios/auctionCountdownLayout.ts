export interface AuctionCountdownLayoutAudit {
    documentFits: boolean
    cardsFit: boolean
    badgesFit: boolean
    timeDisplaysFit: boolean
    cardCount: number
    badgeCount: number
    timeDisplayCount: number
}

export function auditAuctionCountdownLayout(
    documentRoot: Document = document,
): AuctionCountdownLayoutAudit {
    const viewportRight = documentRoot.documentElement.clientWidth
    const cards = [
        ...documentRoot.querySelectorAll<HTMLElement>(
            '[data-testid="auction-countdown-tags-scenario"] article',
        ),
    ]
    const badges = [
        ...documentRoot.querySelectorAll<HTMLElement>(
            '[data-countdown-candidate]',
        ),
    ]
    const timeDisplays = [
        ...documentRoot.querySelectorAll<HTMLElement>(
            '[data-auction-time-display]',
        ),
    ]
    const withinViewport = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect()
        return rect.left >= 0 && rect.right <= viewportRight + 1
    }

    return {
        documentFits: documentRoot.documentElement.scrollWidth <= viewportRight,
        cardsFit: cards.length > 0 && cards.every(withinViewport),
        badgesFit:
            badges.length > 0 &&
            badges.every(
                (badge) =>
                    withinViewport(badge) &&
                    badge.scrollWidth <= badge.clientWidth + 1,
            ),
        timeDisplaysFit:
            timeDisplays.length > 0 && timeDisplays.every(withinViewport),
        cardCount: cards.length,
        badgeCount: badges.length,
        timeDisplayCount: timeDisplays.length,
    }
}
