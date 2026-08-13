import { lazy, Suspense, useMemo } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import AuthLayout from '@/components/layout/AuthLayout'
import { findWorkbenchScenario, WORKBENCH_SCENARIOS } from './registry'
import type {
    SemanticStyle,
    WorkbenchFixture,
    WorkbenchScenarioDefinition,
    WorkbenchScenarioModule,
} from './types'

const WORKBENCH_BUILD_MARKER = 'FC_WORKBENCH_MARKER_284'

export default function WorkbenchRoutes() {
    const { pathname } = useLocation()
    const scenarioId =
        pathname === '/__design'
            ? undefined
            : pathname.slice('/__design/'.length)
    const definition = findWorkbenchScenario(scenarioId)

    if (scenarioId === undefined || scenarioId.length === 0) {
        return <WorkbenchIndex />
    }
    if (!definition) {
        return <WorkbenchNotFound scenarioId={scenarioId} />
    }

    return (
        <ScenarioLoader
            key={definition.id}
            definition={definition}
            marker={WORKBENCH_BUILD_MARKER}
        />
    )
}

function ScenarioLoader<TFixture extends WorkbenchFixture>({
    definition,
}: {
    definition: WorkbenchScenarioDefinition<TFixture>
    marker: string
}) {
    const Scenario = useMemo(
        () =>
            lazy(async () => {
                const module = await definition.load()
                return {
                    default: () => (
                        <LoadedScenario
                            definition={definition}
                            module={module}
                        />
                    ),
                }
            }),
        [definition],
    )

    return (
        <Suspense
            fallback={
                <div
                    role="status"
                    className="grid min-h-screen place-items-center bg-content-soft text-sm font-semibold text-content-muted"
                >
                    시나리오를 불러오는 중입니다.
                </div>
            }
        >
            <Scenario />
        </Suspense>
    )
}

function LoadedScenario<TFixture extends WorkbenchFixture>({
    definition,
    module,
}: {
    definition: WorkbenchScenarioDefinition<TFixture>
    module: WorkbenchScenarioModule<TFixture>
}) {
    const browserLocation = useLocation()
    const requestedVariant = new URLSearchParams(browserLocation.search).get(
        'variant',
    )
    const variant = definition.variants?.includes(requestedVariant ?? '')
        ? requestedVariant
        : definition.variants?.[0]
    const overrides = variant
        ? module.fixture.semanticOverridesByVariant?.[variant]
        : undefined
    const routeLocation = {
        ...browserLocation,
        pathname: definition.routeContext,
    }
    const Preview = module.default
    const Shell = definition.shell === 'app' ? AppShell : AuthLayout

    return (
        <div style={overrides as SemanticStyle | undefined}>
            <Routes location={routeLocation}>
                <Route element={<Shell />}>
                    <Route
                        path={definition.routeContext}
                        element={<Preview fixture={module.fixture} />}
                    />
                </Route>
            </Routes>
        </div>
    )
}

function WorkbenchIndex() {
    return (
        <main className="min-h-screen bg-content-soft px-4 py-10 text-content-fg">
            <section className="mx-auto max-w-3xl rounded-2xl border border-content-line bg-content-surface p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold">디자인 워크벤치</h1>
                <p className="mt-2 max-w-[65ch] text-sm text-content-muted">
                    운영 앱의 토큰, provider, shell과 공용 컴포넌트를 그대로
                    사용하는 개발 전용 시나리오입니다.
                </p>
                <ul className="mt-6 divide-y divide-content-line">
                    {WORKBENCH_SCENARIOS.map((scenario) => (
                        <li key={scenario.id}>
                            <Link
                                to={`/__design/${scenario.id}`}
                                className="flex min-h-11 items-center justify-between gap-4 py-3 font-semibold text-brand-structure hover:text-control-action-hover"
                            >
                                <span>{scenario.title}</span>
                                <span className="text-xs text-content-subtle">
                                    {scenario.shell}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </main>
    )
}

function WorkbenchNotFound({ scenarioId }: { scenarioId: string }) {
    return (
        <main className="grid min-h-screen place-items-center bg-content-soft px-4">
            <section className="max-w-md rounded-2xl border border-content-line bg-content-surface p-8 text-center shadow-sm">
                <h1 className="text-xl font-bold">
                    등록되지 않은 시나리오입니다.
                </h1>
                <p className="mt-2 break-all text-sm text-content-muted">
                    {scenarioId}
                </p>
                <Link
                    to="/__design"
                    className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                >
                    시나리오 목록으로
                </Link>
            </section>
        </main>
    )
}
