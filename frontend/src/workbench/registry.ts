import { auctionDetailPath, paths } from '@/app/paths'
import { COLOR_PALETTE_VARIANT_IDS } from './scenarioMetadata'
import type { WorkbenchFixture, WorkbenchScenarioDefinition } from './types'

function defineScenario(
    definition: WorkbenchScenarioDefinition<WorkbenchFixture>,
) {
    return definition
}

export const WORKBENCH_SCENARIOS = [
    defineScenario({
        id: 'main-color-palettes',
        title: '내비게이션 · 푸터 · 버튼 메인 컬러 10안',
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
] as const

export function findWorkbenchScenario(id: string | undefined) {
    return WORKBENCH_SCENARIOS.find((scenario) => scenario.id === id)
}
