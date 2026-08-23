import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react'
import ActionConfirmDialog from './ActionConfirmDialog'

type AlertTone = 'action' | 'danger'

interface AlertOptions {
    title: string
    description: string
    confirmLabel?: string
    tone?: AlertTone
}

type ConfirmOptions = AlertOptions

interface AlertRequest extends Required<
    Pick<AlertOptions, 'title' | 'description'>
> {
    confirmLabel: string
    tone: AlertTone
    showCancel: boolean
}

interface AppAlertApi {
    alert: (options: AlertOptions) => Promise<void>
    confirm: (options: ConfirmOptions) => Promise<boolean>
    success: (title: string, description: string) => Promise<void>
    error: (title: string, description: string) => Promise<void>
    danger: (options: Omit<ConfirmOptions, 'tone'>) => Promise<boolean>
}

const AppAlertContext = createContext<AppAlertApi | null>(null)

export function AppAlertProvider({ children }: { children: ReactNode }) {
    const [request, setRequest] = useState<AlertRequest | null>(null)
    const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

    const open = useCallback(
        (options: AlertOptions, showCancel: boolean) =>
            new Promise<boolean>((resolve) => {
                resolverRef.current?.(false)
                resolverRef.current = resolve
                setRequest({
                    title: options.title,
                    description: options.description,
                    confirmLabel:
                        options.confirmLabel ?? (showCancel ? '확인' : '닫기'),
                    tone: options.tone ?? 'action',
                    showCancel,
                })
            }),
        [],
    )

    const settle = useCallback((confirmed: boolean) => {
        resolverRef.current?.(confirmed)
        resolverRef.current = null
        setRequest(null)
    }, [])

    const api = useMemo<AppAlertApi>(
        () => ({
            alert: async (options) => {
                await open(options, false)
            },
            confirm: (options) => open(options, true),
            success: async (title, description) => {
                await open({ title, description }, false)
            },
            error: async (title, description) => {
                await open({ title, description, tone: 'danger' }, false)
            },
            danger: (options) => open({ ...options, tone: 'danger' }, true),
        }),
        [open],
    )

    return (
        <AppAlertContext.Provider value={api}>
            {children}
            <ActionConfirmDialog
                open={request !== null}
                tone={request?.tone}
                title={request?.title ?? ''}
                description={request?.description ?? ''}
                confirmLabel={request?.confirmLabel ?? '확인'}
                showCancel={request?.showCancel}
                onCancel={() => settle(false)}
                onConfirm={() => settle(true)}
            />
        </AppAlertContext.Provider>
    )
}

export function useAppAlert() {
    const context = useContext(AppAlertContext)
    if (context === null)
        throw new Error('useAppAlert must be used within AppAlertProvider')
    return context
}
