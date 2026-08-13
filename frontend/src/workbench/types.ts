import type { ComponentType, CSSProperties } from 'react'
import type { BalanceResponse } from '@/lib/api/balance'
import type { AuthSession } from '@/store/authStore'

export type WorkbenchShell = 'app' | 'auth'
export type WorkbenchScenarioId = string

export const SEMANTIC_OVERRIDE_KEYS = [
    '--chrome-bg',
    '--chrome-bg-strong',
    '--chrome-bg-raised',
    '--chrome-bg-selected',
    '--control-action',
    '--control-action-hover',
    '--control-action-ink',
    '--control-focus',
    '--control-focus-on-dark',
] as const

export type SemanticOverrideKey = (typeof SEMANTIC_OVERRIDE_KEYS)[number]
export type SemanticTokenOverrides = Partial<
    Record<SemanticOverrideKey, string>
>

export interface WorkbenchFixture {
    [key: string]: unknown
    shellState?: {
        authSession: AuthSession | null
        balance?: BalanceResponse
        unreadMemoCount?: number
    }
    semanticOverridesByVariant?: Readonly<
        Record<string, SemanticTokenOverrides>
    >
}

export interface WorkbenchScenarioDefinition<
    TFixture extends WorkbenchFixture,
> {
    id: WorkbenchScenarioId
    title: string
    shell: WorkbenchShell
    routeContext: string
    load: () => Promise<WorkbenchScenarioModule<TFixture>>
    variants?: readonly string[]
}

export interface WorkbenchScenarioModule<TFixture extends WorkbenchFixture> {
    default: ComponentType<{ fixture: TFixture }>
    fixture: TFixture
}

export type SemanticStyle = CSSProperties &
    Partial<Record<SemanticOverrideKey, string>>
