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
            ({ id }) => id === NAVIGATION_LAYOUT_VARIANTS.balanced,
        )!

    useLayoutEffect(() => {
        const media = window.matchMedia('(min-width: 1280px)')
        let release: () => void = () => undefined
        let frame = 0
        const apply = () => {
            release()
            cancelAnimationFrame(frame)
            if (
                !media.matches &&
                selected.id !== NAVIGATION_LAYOUT_VARIANTS.contentCompanion
            )
                return
            frame = requestAnimationFrame(() => {
                if (!scenarioRef.current) return
                release = installNavigationLayoutPreview(
                    scenarioRef.current,
                    selected.id as NavigationLayoutVariantId,
                )
            })
        }
        apply()
        media.addEventListener('change', apply)
        return () => {
            media.removeEventListener('change', apply)
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
                    위의 실제 상단 바와 메뉴, 아래의 실제 푸터를 함께 보며 콘텐츠
                    폭, 좌우 여백, 입체감을 비교합니다. 메뉴·인증·잔액 고정 데이터와
                    키보드 동작은 운영 컴포넌트를 그대로 사용합니다.
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

            {selected.id === NAVIGATION_LAYOUT_VARIANTS.contentCompanion && (
                <section className="min-h-screen rounded-xl border border-content-line bg-content-surface p-4">
                    <h2 className="text-lg font-bold text-content-fg">
                        스크롤 동작 확인 영역
                    </h2>
                    <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                        아래로 스크롤해도 실제 내비게이션은 콘텐츠와 같은 가로 폭을
                        유지하며 화면 상단 12px 위치를 따라옵니다. 메뉴와 드롭다운은
                        잘리지 않도록 열린 영역에 유지됩니다.
                    </p>
                </section>
            )}

            <p className="rounded-lg border border-content-line bg-content-surface px-4 py-3 text-sm leading-6 text-content-muted">
                390px에서는 기존 모바일 상단 바와 safe-area 하단 메뉴를 유지합니다.
                콘텐츠 동행형은 모바일에서도 같은 폭을 유지하고, 나머지 데스크톱
                전용 틀은 1280px 이상에서만 적용됩니다.
            </p>
        </div>
    )
}
