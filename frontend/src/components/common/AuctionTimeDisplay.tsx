import type { HTMLAttributes, ReactNode } from 'react'
import './AuctionTimeDisplay.css'

export type AuctionTimeTone = 'timecode' | 'quiet' | 'bare'

export function AuctionTimeDisplay({
    tone = 'timecode',
    label,
    leading,
    ariaLabel,
    className = '',
    children,
}: {
    tone?: AuctionTimeTone
    label?: string
    leading?: ReactNode
    ariaLabel?: string
    className?: string
    children: ReactNode
}) {
    return (
        <span
            data-auction-time-display
            aria-label={ariaLabel}
            className={`auction-time-display auction-time-display--${tone} ${className}`.trim()}
        >
            {leading}
            {label ? (
                <span className="auction-time-display__label">{label}</span>
            ) : null}
            <time
                aria-hidden={ariaLabel ? 'true' : undefined}
                className="auction-time-display__digits"
            >
                {children}
            </time>
        </span>
    )
}

export function AuctionInfoRail({
    tone = 'dark',
    children,
}: {
    tone?: 'dark' | 'soft'
    children: ReactNode
}) {
    return (
        <span
            data-auction-info-rail
            className={`auction-info-rail pointer-events-none ${tone === 'soft' ? 'auction-info-rail--soft' : ''}`}
        >
            {children}
        </span>
    )
}

export function AuctionInfoGroup({ children }: { children: ReactNode }) {
    return <span className="auction-info-rail__group">{children}</span>
}

export function AuctionTimeCatalog(props: HTMLAttributes<HTMLElement>) {
    return <section className="auction-time-catalog" {...props} />
}

export function AuctionTimeShowcase(props: HTMLAttributes<HTMLDivElement>) {
    return <div className="auction-time-showcase" {...props} />
}
