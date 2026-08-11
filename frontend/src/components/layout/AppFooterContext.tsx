import { createContext, useContext, useLayoutEffect } from 'react'

export type AppFooterVariant = 'default' | 'compact'

const AppFooterVariantContext = createContext<
    ((variant: AppFooterVariant) => void) | null
>(null)

export const AppFooterVariantProvider = AppFooterVariantContext.Provider

/** route가 콘텐츠 의미에 따라 footer 밀도를 명시한다. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAppFooterVariant(variant: AppFooterVariant) {
    const setVariant = useContext(AppFooterVariantContext)

    useLayoutEffect(() => {
        if (!setVariant) return
        setVariant(variant)
        return () => setVariant('default')
    }, [setVariant, variant])
}
