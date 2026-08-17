import type { HTMLAttributes, ReactNode } from 'react'
import './VuexyBadge.css'

export type VuexyBadgeVariant = 'solid' | 'tonal' | 'outlined'
export type VuexyBadgeSize = 'small' | 'medium'
export type VuexyBadgeShape = 'rounded' | 'pill'

export const VUEXY_BADGE_GEOMETRY = {
    height: '1.5rem',
    paddingInline: '0.625rem',
    paddingBlock: '0.125rem',
    typeSize: '0.8125rem',
    lineHeight: '1.53846154',
    fontWeight: 500,
    iconSize: '1rem',
    shadow: 'none',
} as const

export interface VuexyBadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: VuexyBadgeVariant
    size?: VuexyBadgeSize
    shape?: VuexyBadgeShape
    leading?: ReactNode
    trailing?: ReactNode
    dot?: boolean
}

/**
 * Vuexy Next.js CustomChip/MuiChip override의 비상호작용 표시용 React 포트.
 * small geometry: 24px height, 10px inline/2px block padding, 13px/20px type, 16px icon.
 */
export default function VuexyBadge({
    variant = 'tonal',
    size = 'small',
    shape = 'rounded',
    leading,
    trailing,
    dot = false,
    className = '',
    children,
    ...props
}: VuexyBadgeProps) {
    const classes = [
        'vuexy-badge',
        `vuexy-badge--${variant}`,
        size === 'medium' ? 'vuexy-badge--medium' : '',
        shape === 'pill' ? 'vuexy-badge--pill' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <span className={classes} data-vuexy-badge="true" {...props}>
            {dot ? <i aria-hidden="true" className="vuexy-badge__dot" /> : null}
            {leading ? (
                <span aria-hidden="true" className="vuexy-badge__icon">
                    {leading}
                </span>
            ) : null}
            <span className="vuexy-badge__label">{children}</span>
            {trailing ? (
                <span aria-hidden="true" className="vuexy-badge__icon">
                    {trailing}
                </span>
            ) : null}
        </span>
    )
}
