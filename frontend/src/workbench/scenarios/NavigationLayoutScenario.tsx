import { useLayoutEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
    navigationLayoutFixture,
    type NavigationLayoutFixture,
} from '../fixtures/navigationLayout'
import { installNavigationLayoutPreview } from '../navigationLayoutPreview'
import { NAVIGATION_LAYOUT_VARIANTS } from '../scenarioMetadata'
import type { NavigationLayoutVariantId } from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = navigationLayoutFixture

export default function NavigationLayoutScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as NavigationLayoutFixture
    const [searchParams] = useSearchParams()
    const scenarioRef = useRef<HTMLDivElement>(null)
    const requested = searchParams.get('variant')
    const selected =
        scenarioFixture.layouts.find(({ id }) => id === requested) ??
        scenarioFixture.layouts.find(
            ({ id }) => id === NAVIGATION_LAYOUT_VARIANTS.contactDock,
        )!

    useLayoutEffect(() => {
        let release: () => void = () => undefined
        let frame = 0
        const apply = () => {
            release()
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                if (!scenarioRef.current) return
                release = installNavigationLayoutPreview(
                    scenarioRef.current,
                    selected.id as NavigationLayoutVariantId,
                )
            })
        }
        apply()
        return () => {
            cancelAnimationFrame(frame)
            release()
        }
    }, [selected.id])

    return (
        <div
            ref={scenarioRef}
            data-testid="navigation-layout-scenario"
            className="flex w-full min-w-0 max-w-full flex-col gap-6"
        >
            <header className="min-w-0 max-w-full">
                <p className="text-sm font-bold text-control-action-hover">
                    실제 AppShell · 브라이트 스틸
                </p>
                <h1 className="mt-1 break-words text-2xl font-bold text-content-fg">
                    상단 네비게이션 레이아웃 4안
                </h1>
                <p className="mt-2 max-w-[65ch] break-words text-sm leading-6 text-content-muted">
                    실제 상단 바와 메뉴가 콘텐츠 경계까지 일반 흐름으로 이동한 뒤
                    고정되는 네 가지 방식을 비교합니다. 내비게이션·콘텐츠·푸터의
                    가로 폭과 실제 인증·잔액·키보드 동작은 그대로 유지합니다.
                </p>
            </header>

            <nav
                aria-label="상단 네비게이션 시안 선택"
                className="grid min-w-0 gap-3 sm:grid-cols-2"
            >
                {scenarioFixture.layouts.map((layout) => {
                    const active = layout.id === selected.id
                    return (
                        <Link
                            key={layout.id}
                            to={`/__design/top-navigation-layouts?variant=${layout.id}`}
                            aria-current={active ? 'true' : undefined}
                            className={`flex min-h-11 min-w-0 flex-col rounded-xl border px-4 py-3 transition-colors ${
                                active
                                    ? 'border-control-action bg-control-action text-control-action-ink'
                                    : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                            }`}
                        >
                            <span className="flex flex-wrap items-center gap-2 font-bold">
                                {layout.name}
                                {layout.recommended && (
                                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success-ink">
                                        권장
                                    </span>
                                )}
                            </span>
                            <span
                                className={`mt-1 text-xs ${active ? 'text-control-action-ink' : 'text-content-subtle'}`}
                            >
                                {layout.label}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            <section className="rounded-xl border border-content-line bg-content-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-content-fg">
                        {selected.name}
                    </h2>
                    <span className="rounded-full bg-brand-structure/10 px-3 py-1 text-xs font-bold text-chrome-selected">
                        {selected.label}
                    </span>
                </div>
                <dl className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="min-w-0">
                        <dt className="text-sm font-bold text-content-fg">
                            설계 의도
                        </dt>
                        <dd className="mt-1 break-words text-sm leading-6 text-content-muted">
                            {selected.summary}
                        </dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-sm font-bold text-content-fg">
                            트레이드오프
                        </dt>
                        <dd className="mt-1 break-words text-sm leading-6 text-content-muted">
                            {selected.tradeoff}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="min-h-screen rounded-xl border border-content-line bg-content-surface p-4">
                <h2 className="text-lg font-bold text-content-fg">
                    임계점과 도킹 상태 확인 영역
                </h2>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                    처음에는 내비게이션이 문서와 함께 움직입니다. 콘텐츠 상단 경계가
                    화면 상단에 닿은 뒤에는 같은 가로 폭을 유지한 채 고정되며, 선택한
                    안에 따라 표면·높이·스크롤 방향 반응만 달라집니다.
                </p>
            </section>

            <p className="rounded-lg border border-content-line bg-content-surface px-4 py-3 text-sm leading-6 text-content-muted">
                390px에서는 실제 모바일 상단 바와 safe-area 하단 메뉴를 유지합니다.
                어떤 안에서도 드롭다운과 메뉴를 자르는 overflow 컨테이너는 만들지
                않습니다.
            </p>
        </div>
    )
}
