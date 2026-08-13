import { auctionDetailPath, paths } from '@/app/paths'
import {
    COLOR_PALETTE_VARIANT_IDS,
    NAVIGATION_LAYOUT_VARIANT_IDS,
} from './scenarioMetadata'
import type { WorkbenchFixture, WorkbenchScenarioDefinition } from './types'

function defineScenario(
    definition: WorkbenchScenarioDefinition<WorkbenchFixture>,
) {
    return definition
}

export const WORKBENCH_SCENARIOS = [
    defineScenario({
        id: 'main-color-palettes',
        title: '밝고 선명한 메인 컬러 10안',
        shell: 'app',
        routeContext: auctionDetailPath('design-preview'),
        variants: COLOR_PALETTE_VARIANT_IDS,
        load: () => import('./scenarios/ColorSystemScenario'),
    }),
    defineScenario({
        id: 'auth-layout',
        title: '인증 레이아웃',
        shell: 'auth',
        routeContext: paths.login,
        load: () => import('./scenarios/AuthLayoutScenario'),
    }),
    defineScenario({
        id: 'top-navigation-layouts',
        title: '상단 네비게이션 레이아웃 3안',
        shell: 'app',
        routeContext: paths.auctions,
        variants: NAVIGATION_LAYOUT_VARIANT_IDS,
        load: () => import('./scenarios/NavigationLayoutScenario'),
    }),
] as const

export function findWorkbenchScenario(id: string | undefined) {
    return WORKBENCH_SCENARIOS.find((scenario) => scenario.id === id)
}
