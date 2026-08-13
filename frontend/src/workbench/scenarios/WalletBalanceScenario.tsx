import { Link, useSearchParams } from 'react-router'
import WalletBalanceCandidate from '../candidates/WalletBalanceCandidate'
import {
    walletBalanceFixture,
    type WalletBalanceFixture,
    type WalletPreviewState,
} from '../fixtures/walletBalance'
import { WALLET_BALANCE_VARIANTS } from '../scenarioMetadata'
import type { WorkbenchFixture } from '../types'

const PREVIEW_STATES = ['ready', 'loading', 'error'] as const
const STATE_LABEL: Record<WalletPreviewState, string> = {
    ready: '정상',
    loading: '로딩',
    error: '오류',
}

// Scenario module contract requires fixture and component exports together.
// eslint-disable-next-line react-refresh/only-export-components
export const fixture = walletBalanceFixture

export default function WalletBalanceScenario({
    fixture: workbenchFixture,
}: {
    fixture: WorkbenchFixture
}) {
    const scenarioFixture = workbenchFixture as WalletBalanceFixture
    const [searchParams] = useSearchParams()
    const requestedVariant = searchParams.get('variant')
    const selected =
        scenarioFixture.options.find(({ id }) => id === requestedVariant) ??
        scenarioFixture.options[4]
    const requestedState = searchParams.get('state')
    const state = PREVIEW_STATES.includes(requestedState as WalletPreviewState)
        ? (requestedState as WalletPreviewState)
        : 'ready'
    const usesLongSample = searchParams.get('sample') === 'long'
    const balance = usesLongSample
        ? scenarioFixture.balances.longSafeInteger
        : scenarioFixture.balances.standard

    const href = (
        variant: string,
        nextState = state,
        longSample = usesLongSample,
    ) =>
        `/__design/wallet-balance-studies?variant=${variant}&state=${nextState}&sample=${longSample ? 'long' : 'standard'}`

    return (
        <div
            data-testid="wallet-balance-scenario"
            className="flex w-full min-w-0 max-w-full flex-col gap-6"
        >
            <header className="w-full min-w-0 max-w-full">
                <p className="text-sm font-bold text-control-action-hover">
                    Bright Steel · 실제 AppShell 지갑 비교
                </p>
                <h1 className="mt-1 w-full min-w-0 max-w-full break-words text-2xl font-bold text-content-fg">
                    마이페이지 지갑 잔액 5안
                </h1>
                <p className="mt-2 max-w-[65ch] break-words text-sm leading-6 text-content-muted">
                    실제 지갑의 총 보유·사용 가능·입찰 보류·캐시 네 값을 그대로
                    사용하고, 정보 위계와 구조만 비교합니다.
                </p>
            </header>

            <section aria-labelledby="wallet-option-heading">
                <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                        <h2
                            id="wallet-option-heading"
                            className="text-lg font-bold"
                        >
                            디자인 안 선택
                        </h2>
                        <p className="mt-1 text-xs text-content-subtle">
                            단순 색 변경이 아닌 정보 구조·위계 비교
                        </p>
                    </div>
                    <span className="rounded-full bg-control-action-soft px-3 py-1 text-xs font-bold text-control-action-hover">
                        {selected.id === WALLET_BALANCE_VARIANTS.balancedMetrics
                            ? 'FinalCall 권장안'
                            : '비교 후보'}
                    </span>
                </div>
                <nav
                    aria-label="지갑 디자인 안"
                    className="mt-3 grid w-full min-w-0 max-w-full grid-cols-1 gap-2 sm:grid-cols-2"
                >
                    {scenarioFixture.options.map((option) => {
                        const active = option.id === selected.id
                        return (
                            <Link
                                key={option.id}
                                to={href(option.id)}
                                aria-current={active ? 'true' : undefined}
                                className={`flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${
                                    active
                                        ? 'border-control-action bg-control-action text-control-action-ink'
                                        : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                                }`}
                            >
                                <span className="min-w-0 break-words">
                                    {option.shortName}
                                </span>
                                <span
                                    className={`shrink-0 text-xs ${active ? 'text-control-action-ink' : 'text-content-subtle'}`}
                                >
                                    {option.reference}
                                </span>
                            </Link>
                        )
                    })}
                </nav>
            </section>

            <section
                aria-labelledby="wallet-state-heading"
                className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 rounded-xl border border-content-line bg-content-soft p-4 sm:grid-cols-2"
            >
                <div className="min-w-0">
                    <h2
                        id="wallet-state-heading"
                        className="text-xs font-bold text-content-muted"
                    >
                        데이터 상태
                    </h2>
                    <nav
                        aria-label="지갑 데이터 상태"
                        className="mt-2 flex flex-wrap gap-2"
                    >
                        {PREVIEW_STATES.map((previewState) => (
                            <Link
                                key={previewState}
                                to={href(
                                    selected.id,
                                    previewState,
                                    usesLongSample,
                                )}
                                aria-current={
                                    previewState === state ? 'true' : undefined
                                }
                                className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-bold transition-colors ${
                                    previewState === state
                                        ? 'border-control-action bg-control-action text-control-action-ink'
                                        : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                                }`}
                            >
                                {STATE_LABEL[previewState]}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="min-w-0">
                    <h2 className="text-xs font-bold text-content-muted">
                        금액 표본
                    </h2>
                    <nav
                        aria-label="지갑 금액 표본"
                        className="mt-2 flex flex-wrap gap-2"
                    >
                        <Link
                            to={href(selected.id, state, false)}
                            aria-current={!usesLongSample ? 'true' : undefined}
                            className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-bold transition-colors ${
                                !usesLongSample
                                    ? 'border-control-action bg-control-action text-control-action-ink'
                                    : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                            }`}
                        >
                            실제 잔액
                        </Link>
                        <Link
                            to={href(selected.id, state, true)}
                            aria-current={usesLongSample ? 'true' : undefined}
                            className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-bold transition-colors ${
                                usesLongSample
                                    ? 'border-control-action bg-control-action text-control-action-ink'
                                    : 'border-content-line bg-content-surface text-content-fg hover:border-control-action'
                            }`}
                        >
                            긴 안전정수
                        </Link>
                    </nav>
                </div>
            </section>

            <section
                data-testid="wallet-study-layout"
                className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 lg:grid-cols-2"
            >
                <article className="w-full min-w-0 max-w-full rounded-2xl border border-content-line bg-content-surface p-5 sm:p-6">
                    <p className="text-xs font-bold text-control-action-hover">
                        {selected.reference}
                    </p>
                    <h2 className="mt-1 break-words text-xl font-bold text-content-fg">
                        {selected.name}
                    </h2>
                    <dl className="mt-5 divide-y divide-content-line border-y border-content-line">
                        <DescriptionRow
                            label="추천 근거"
                            value={selected.recommendation}
                        />
                        <DescriptionRow
                            label="트레이드오프"
                            value={selected.tradeoff}
                        />
                        <DescriptionRow
                            label="폰트 스펙"
                            value={selected.fontSpec}
                        />
                    </dl>
                    <p className="mt-4 break-words text-xs leading-5 text-content-subtle">
                        금액은 공용 CodeAmount의 full 표시와 tabular nums를
                        재사용합니다. 200% 텍스트 확대에서도 각 지표가
                        줄바꿈되도록 고정 폭을 두지 않았습니다.
                    </p>
                </article>

                <div className="w-full min-w-0 max-w-full">
                    <WalletBalanceCandidate
                        balance={balance}
                        state={state}
                        variant={selected.id}
                    />
                </div>
            </section>
        </div>
    )
}

function DescriptionRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 py-3">
            <dt className="text-xs font-bold text-content-muted">{label}</dt>
            <dd className="mt-1 break-words text-sm leading-6 text-content-fg">
                {value}
            </dd>
        </div>
    )
}
