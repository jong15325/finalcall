import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { TbPlus } from 'react-icons/tb'
import type { ComponentType } from 'react'

interface MobileBottomNavActionProps {
    icon?: ComponentType<{
        className?: string
        'aria-hidden'?: boolean
        strokeWidth?: number
    }>
    label: string
    to: string
}

interface FloatingActionButtonProps extends Omit<
    MobileBottomNavActionProps,
    'to'
> {
    onClick: () => void
}

export function RegistrationActionLink({
    icon: Icon = TbPlus,
    label,
    to,
    mobile = false,
}: MobileBottomNavActionProps & { mobile?: boolean }) {
    return (
        <Link
            {...(mobile ? { 'data-mobile-nav-action': true } : {})}
            data-registration-action
            aria-label={label}
            title={label}
            to={to}
            className="pointer-events-auto grid size-[52px] place-items-center rounded-full transition-[transform,background-color] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
        >
            <Icon aria-hidden className="size-7" strokeWidth={2.2} />
        </Link>
    )
}

export function DesktopPageAction(props: MobileBottomNavActionProps) {
    return (
        <div
            data-desktop-page-action
            className="mt-4 hidden justify-end xl:flex"
        >
            <RegistrationActionLink {...props} />
        </div>
    )
}

export function FloatingActionButton({
    icon: Icon = TbPlus,
    label,
    onClick,
    mobile = false,
}: FloatingActionButtonProps & { mobile?: boolean }) {
    return (
        <button
            {...(mobile ? { 'data-mobile-nav-action': true } : {})}
            data-registration-action
            type="button"
            aria-label={label}
            title={label}
            className="pointer-events-auto grid size-[52px] place-items-center rounded-full transition-[transform,background-color] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
            onClick={onClick}
        >
            <Icon aria-hidden className="size-7" strokeWidth={2.2} />
        </button>
    )
}

export function DesktopPageButton(props: FloatingActionButtonProps) {
    return (
        <div
            data-desktop-page-action
            className="mt-4 hidden justify-end xl:flex"
        >
            <FloatingActionButton {...props} />
        </div>
    )
}

export function MobileBottomNavButton(props: FloatingActionButtonProps) {
    const [slot, setSlot] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setSlot(document.getElementById('mobile-bottom-nav-action-slot'))
    }, [])

    if (!slot) return null

    return createPortal(<FloatingActionButton mobile {...props} />, slot)
}

function MobileBottomNavAction({
    icon,
    label,
    to,
}: MobileBottomNavActionProps) {
    const [slot, setSlot] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setSlot(document.getElementById('mobile-bottom-nav-action-slot'))
    }, [])

    if (!slot) return null

    return createPortal(
        <RegistrationActionLink mobile icon={icon} label={label} to={to} />,
        slot,
    )
}

export default MobileBottomNavAction
