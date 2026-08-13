import { Link, useSearchParams } from 'react-router'
import CodeAmount from '@/components/common/CodeAmount'
import ListFrame from '@/components/common/ListFrame'
import WalletSummaryCard from '@/features/member/components/WalletSummaryCard'
import { COLOR_PALETTES } from '../fixtures/colorSystem'
import type {
    SemanticStyle,
    SemanticTokenOverrides,
    WorkbenchFixture,
} from '../types'

const PREVIEW_STATES = ['loading', 'empty', 'error', 'success'] as const
type PreviewState = (typeof PREVIEW_STATES)[number]

const PREVIEW_STATE_LABEL: Record<PreviewState, string> = {
    loading: '로딩',
    empty: '빈 결과',
    error: '오류',
    success: '성공',
}

interface ColorSystemFixture extends WorkbenchFixture {
    palettes: typeof COLOR_PALETTES
    semanticOverridesByVariant: Readonly<Record<string, SemanticTokenOverrides>>
}

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = {
    palettes: COLOR_PALETTES,
    semanticOverridesByVariant: Object.fromEntries(
        COLOR_PALETTES.map((palette) => [palette.id, palette.overrides]),
    ),
} satisfies ColorSystemFixture

export default function ColorSystemScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as ColorSystemFixture
    const [searchParams] = useSearchParams()
    const requested = searchParams.get('variant')
    const selected =
        scenarioFixture.palettes.find(({ id }) => id === requested) ??
        scenarioFixture.palettes[0]
    const requestedState = searchParams.get('state')
    const previewState = PREVIEW_STATES.includes(requestedState as PreviewState)
        ? (requestedState as PreviewState)
        : 'success'

    return (
        <div
            data-testid="color-system-scenario"
            className="flex min-w-0 max-w-full flex-col gap-8"
        >
            <header className="min-w-0">
                <p className="text-sm font-bold text-control-action-hover">
                    실제 AppShell 기반 비교
                </p>
                <h1 className="mt-1 min-w-0 break-words text-2xl font-bold text-content-fg">
                    내비게이션 · 푸터 · 버튼 메인 컬러 10안
                </h1>
                <p className="mt-2 max-w-[65ch] text-sm leading-6 text-content-muted">
                    선택한 팔레트가 현재 화면의 실제 내비게이션, 푸터와 주요
                    행동 토큰에 함께 적용됩니다. 상태색은 변경하지 않습니다.
                </p>
            </header>

            <section aria-labelledby="palette-options-title">
                <div className="flex items-end justify-between gap-4">
                    <h2
                        id="palette-options-title"
                        className="text-lg font-bold"
                    >
                        팔레트 선택
                    </h2>
                    <span className="shrink-0 text-xs text-content-subtle">
                        추천 순위 {selected.rank}/10
                    </span>
                </div>
                <div
                    data-testid="palette-selector"
                    className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1"
                >
                    {scenarioFixture.palettes.map((palette) => {
                        const active = palette.id === selected.id
                        return (
                            <Link
                                key={palette.id}
                                to={`/__design/main-color-palettes?variant=${palette.id}&state=${previewState}`}
                                aria-current={active ? 'true' : undefined}
                                style={palette.overrides as SemanticStyle}
                                className={`min-h-11 min-w-52 shrink-0 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors ${
                                    active
                                        ? 'border-control-action bg-control-action text-control-action-ink'
                                        : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                                }`}
                            >
                                <span className="block">{palette.name}</span>
                                <span
                                    className={`mt-0.5 block text-xs ${active ? 'text-control-action-ink' : 'text-content-subtle'}`}
                                >
                                    {palette.label}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </section>

            <section
                data-testid="palette-preview-grid"
                className="grid min-w-0 gap-4 min-[1000px]:grid-cols-2"
            >
                <article className="min-w-0 rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="break-words text-lg font-bold">
                                {selected.name}
                            </h2>
                            <p className="mt-1 text-xs font-semibold text-content-subtle">
                                {selected.label} · 순위 {selected.rank}/10
                            </p>
                        </div>
                        {selected.experiment && (
                            <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">
                                계약 변경 실험안
                            </span>
                        )}
                    </div>
                    <p className="mt-4 max-w-[65ch] text-sm leading-6 text-content-muted">
                        {selected.note}
                    </p>
                    <dl className="mt-5 min-w-0 divide-y divide-content-line rounded-xl border border-content-line px-4">
                        {Object.entries(selected.overrides).map(
                            ([token, value]) => (
                                <div
                                    key={token}
                                    data-testid="semantic-token-row"
                                    className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-2.5 text-xs"
                                >
                                    <dt className="min-w-0 break-words font-mono text-content-muted">
                                        {token}
                                    </dt>
                                    <dd className="shrink-0 font-bold text-content-fg">
                                        {value}
                                    </dd>
                                </div>
                            ),
                        )}
                    </dl>
                </article>

                <section className="min-w-0 rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
                    <h2 className="text-lg font-bold">UI 상태 선택</h2>
                    <p className="mt-1 text-xs text-content-subtle">
                        공용 ListFrame과 WalletSummaryCard의 실제 상태입니다.
                    </p>
                    <nav
                        aria-label="UI 상태"
                        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                        {PREVIEW_STATES.map((state) => {
                            const active = state === previewState
                            return (
                                <Link
                                    key={state}
                                    to={`/__design/main-color-palettes?variant=${selected.id}&state=${state}`}
                                    aria-current={active ? 'true' : undefined}
                                    className={`flex min-h-11 items-center justify-center rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                                        active
                                            ? 'border-control-action bg-control-action text-control-action-ink'
                                            : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                                    }`}
                                >
                                    {PREVIEW_STATE_LABEL[state]}
                                </Link>
                            )
                        })}
                    </nav>
                </section>
            </section>

            <section aria-labelledby="state-preview-title">
                <h2 id="state-preview-title" className="mb-3 text-lg font-bold">
                    실제 공용 상태와 주요 행동 ·{' '}
                    {PREVIEW_STATE_LABEL[previewState]}
                </h2>
                <ListFrame
                    state={listFrameState(previewState)}
                    layout="two-column"
                    label="디자인 상태 미리보기"
                    renderSkeleton={() => (
                        <WalletSummaryCard
                            isLoading
                            balance={undefined}
                            isError={false}
                        />
                    )}
                >
                    <WalletSummaryCard
                        balance={{
                            gameMoneyBalance: 1_520_000,
                            gameMoneyAvailable: 1_240_000,
                            gameMoneyHeld: 280_000,
                            cashBalance: 50_000,
                        }}
                        isLoading={false}
                        isError={false}
                    />
                </ListFrame>
            </section>

            <section className="flex flex-wrap items-center gap-3 rounded-xl bg-content-soft p-4">
                <span className="text-xs font-semibold text-content-muted">
                    금액 숫자 안정성
                </span>
                <CodeAmount
                    value={1_260_000}
                    mode="full"
                    className="text-lg font-bold tabular-nums text-content-fg"
                />
                <button
                    disabled
                    type="button"
                    className="ms-auto min-h-11 rounded-lg bg-content-line px-4 text-sm font-bold text-content-subtle"
                >
                    처리 중
                </button>
            </section>
        </div>
    )
}

function listFrameState(state: PreviewState) {
    if (state === 'loading') return { kind: 'loading' as const, count: 2 }
    if (state === 'empty') {
        return {
            kind: 'empty' as const,
            title: '표시할 항목이 없습니다.',
            description: 'fixture를 바꾸지 않고 빈 결과 상태를 확인합니다.',
        }
    }
    if (state === 'error') {
        return {
            kind: 'error' as const,
            message: '고정 fixture로 오류와 다시 시도 행동을 확인합니다.',
            onRetry: () => undefined,
        }
    }
    return { kind: 'ready' as const }
}
