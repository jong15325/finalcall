import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type AppModalButtonVariant = 'primary' | 'secondary' | 'danger'

interface AppModalButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: AppModalButtonVariant
    children: ReactNode
}

/** Shared modal action button. Visual state, hover, press, focus and disabled
 * behavior are owned by the modal system rather than individual features. */
const AppModalButton = forwardRef<HTMLButtonElement, AppModalButtonProps>(
    function AppModalButton(
        { variant = 'primary', className = '', children, ...props },
        ref,
    ) {
        return (
            <button
                ref={ref}
                className={`app-modal-button ${className}`.trim()}
                data-modal-button={variant}
                {...props}
            >
                <span className="app-modal-button__label">{children}</span>
            </button>
        )
    },
)

export default AppModalButton
