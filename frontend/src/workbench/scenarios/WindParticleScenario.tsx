import { Link, useSearchParams } from 'react-router'
import WindParticleCanvas from '../candidates/WindParticleCanvas'
import {
    windParticleFixture,
    type WindParticleFixture,
} from '../fixtures/windParticles'
import type { WorkbenchFixture } from '../types'

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = windParticleFixture

export default function WindParticleScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as WindParticleFixture
    const [searchParams] = useSearchParams()
    const requested = searchParams.get('variant')
    const selected =
        scenarioFixture.options.find(({ id }) => id === requested) ??
        scenarioFixture.options[0]

    return (
        <div
            data-testid="wind-particle-scenario"
            className="flex w-full min-w-0 max-w-full flex-col gap-8"
        >
            <header className="w-full min-w-0 max-w-full">
                <p className="text-sm font-bold text-control-action-hover">
                    DEV-only · 실제 월드맵 좌하단 비율
                </p>
                <h1 className="mt-1 break-words text-2xl font-bold text-content-fg">
                    바람 파티클 렌더링 10안
                </h1>
                <p className="mt-2 max-w-[65ch] break-words text-sm leading-6 text-content-muted">
                    속도·감쇠·밀도를 분리한 저비용 Canvas 후보입니다. 각 안은
                    색만 바꾼 평행선이 아니라 궤적, 리본, 컬 필드, 이류, 펄스,
                    와류, 깃털, 광점, 등압선, 혼합 레이어처럼 서로 다른 렌더링
                    원리를 사용합니다.
                </p>
            </header>

            <section
                aria-labelledby="wind-comparison-title"
                className="w-full min-w-0 max-w-full"
            >
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2
                            id="wind-comparison-title"
                            className="text-lg font-bold"
                        >
                            동시 비교
                        </h2>
                        <p className="mt-1 text-xs leading-5 text-content-subtle">
                            선택안 {selected.rank}위 · {selected.name}
                        </p>
                    </div>
                    <p className="text-xs font-semibold text-content-muted">
                        reduced-motion·데이터 절약 모드: 정적 대표 프레임
                    </p>
                </div>

                <div className="mt-4 grid w-full min-w-0 max-w-full gap-4 sm:grid-cols-2">
                    {scenarioFixture.options.map((option) => {
                        const active = option.id === selected.id
                        return (
                            <article
                                key={option.id}
                                data-wind-variant={option.id}
                                className={`w-full min-w-0 max-w-full rounded-2xl border bg-content-surface p-4 shadow-sm ${
                                    active
                                        ? 'border-control-action'
                                        : 'border-content-line'
                                }`}
                            >
                                <div className="flex min-w-0 items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-control-action-hover">
                                            추천 {option.rank}위
                                        </p>
                                        <h3 className="mt-1 break-words text-lg font-bold text-content-fg">
                                            {option.name}
                                        </h3>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-content-soft px-3 py-1 text-xs font-bold text-content-muted">
                                        비용 {option.performance}
                                    </span>
                                </div>

                                <div className="mt-4">
                                    <WindParticleCanvas
                                        option={option}
                                        colors={scenarioFixture.colors}
                                    />
                                </div>

                                <dl className="mt-4 space-y-3 text-sm leading-6">
                                    <div>
                                        <dt className="font-bold text-content-fg">
                                            렌더링 원리
                                        </dt>
                                        <dd className="break-words text-content-muted">
                                            {option.principle}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="font-bold text-content-fg">
                                            추천 이유
                                        </dt>
                                        <dd className="break-words text-content-muted">
                                            {option.recommendation}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="font-bold text-content-fg">
                                            트레이드오프
                                        </dt>
                                        <dd className="break-words text-content-muted">
                                            {option.tradeoff}
                                        </dd>
                                    </div>
                                </dl>

                                <Link
                                    to={`/__design/wind-particle-studies?variant=${option.id}`}
                                    aria-current={active ? 'true' : undefined}
                                    className={`mt-4 flex min-h-11 w-full items-center justify-center rounded-lg border px-4 text-sm font-bold transition-colors ${
                                        active
                                            ? 'border-control-action bg-control-action text-control-action-ink'
                                            : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                                    }`}
                                >
                                    {active ? '선택됨' : '이 안 선택'}
                                </Link>
                            </article>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
