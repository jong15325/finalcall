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
    shellState: {
        authSession: {
            accessToken: 'workbench-access-token',
            refreshToken: 'workbench-refresh-token',
            accessExpiresAt: '2099-01-01T00:00:00Z',
            user: {
                userPublicId: 'workbench-user',
                nickname: '프리뷰 사용자',
                isAdmin: false,
            },
        },
        balance: {
            gameMoneyBalance: 1_520_000,
            gameMoneyAvailable: 1_240_000,
            gameMoneyHeld: 280_000,
            cashBalance: 50_000,
        },
        unreadMemoCount: 3,
    },
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
            className="flex w-full min-w-0 max-w-full flex-col gap-8"
        >
            <header className="w-full min-w-0 max-w-full">
                <p className="text-sm font-bold text-control-action-hover">
                    Restrained · 실제 AppShell 기반 비교
                </p>
                <h1 className="mt-1 w-full min-w-0 max-w-full break-all text-2xl font-bold text-content-fg">
                    밝고 선명한 메인 컬러 10안
                </h1>
                <p className="mt-2 w-full min-w-0 max-w-full break-words text-sm leading-6 text-content-muted">
                    후보색은 실제 내비게이션·푸터·주요 버튼·현재 선택에만
                    적용됩니다. 취소는 중립, 승인·성공은 초록, 위험은 빨강으로
                    고정해 거래 상태의 의미를 보존합니다.
                </p>
            </header>

            <section
                aria-labelledby="palette-options-title"
                className="w-full min-w-0 max-w-full"
            >
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
                    className="mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1"
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
                className="grid w-full min-w-0 max-w-full gap-4 min-[1000px]:grid-cols-2"
            >
                <article className="w-full min-w-0 max-w-full rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="break-words text-lg font-bold">
                                {selected.name}
                            </h2>
                            <p className="mt-1 text-xs font-semibold text-content-subtle">
                                {selected.label} · 순위 {selected.rank}/10
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 w-full min-w-0 max-w-full space-y-3 text-sm leading-6">
                        <div>
                            <p className="font-bold text-content-fg">
                                추천 근거
                            </p>
                            <p className="break-words text-content-muted">
                                {selected.note}
                            </p>
                        </div>
                        <div>
                            <p className="font-bold text-content-fg">
                                트레이드오프
                            </p>
                            <p className="break-words text-content-muted">
                                {selected.tradeoff}
                            </p>
                        </div>
                    </div>
                    <dl className="mt-5 w-full min-w-0 max-w-full divide-y divide-content-line rounded-xl border border-content-line px-4">
                        {Object.entries(selected.overrides).map(
                            ([token, value]) => (
                                <div
                                    key={token}
                                    data-testid="semantic-token-row"
                                    className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-between gap-4 py-2.5 text-xs"
                                >
                                    <dt className="min-w-0 max-w-full break-all font-mono text-content-muted">
                                        {token}
                                    </dt>
                                    <dd className="min-w-0 max-w-full break-all font-bold text-content-fg">
                                        {value}
                                    </dd>
                                </div>
                            ),
                        )}
                    </dl>
                </article>

                <section className="w-full min-w-0 max-w-full rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
                    <h2 className="text-lg font-bold">색 역할 비교</h2>
                    <p className="mt-1 text-xs leading-5 text-content-subtle">
                        후보 메인색과 고정 의미색이 실제 거래 조작에서 어떻게
                        분리되는지 비교합니다.
                    </p>
                    <div
                        data-testid="candidate-action-scope"
                        className="mt-4 rounded-xl border border-content-line bg-content-soft p-4"
                    >
                        <p className="text-xs font-bold text-content-muted">
                            후보색 적용 · 주요 행동과 현재 선택
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="min-h-11 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
                            >
                                입찰하기
                            </button>
                            <button
                                type="button"
                                aria-pressed="true"
                                className="min-h-11 rounded-lg border border-control-action bg-content-surface px-4 text-sm font-bold text-control-action-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-control-focus focus-visible:ring-offset-2"
                            >
                                선택됨
                            </button>
                        </div>
                    </div>
                    <div
                        data-testid="fixed-semantic-scope"
                        className="mt-3 rounded-xl border border-content-line bg-content-soft p-4"
                    >
                        <p className="text-xs font-bold text-content-muted">
                            항상 고정 · 취소 / 승인·성공 / 위험
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                className="min-h-11 rounded-lg border border-content-line bg-content-surface px-4 text-sm font-bold text-content-muted"
                            >
                                취소
                            </button>
                            <span className="inline-flex min-h-11 items-center rounded-lg bg-success-soft px-4 text-sm font-bold text-success-ink">
                                승인 완료
                            </span>
                            <button
                                type="button"
                                className="min-h-11 rounded-lg bg-danger px-4 text-sm font-bold text-on-strong hover:opacity-90"
                            >
                                거래 취소
                            </button>
                        </div>
                    </div>

                    <h2 className="mt-6 text-lg font-bold">UI 상태 선택</h2>
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

            <section
                aria-labelledby="state-preview-title"
                className="w-full min-w-0 max-w-full"
            >
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

            <section className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-3 rounded-xl bg-content-soft p-4">
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
