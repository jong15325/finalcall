import type { CSSProperties } from 'react'
import CodeAmount from '@/components/common/CodeAmount'
import type { BalanceResponse } from '@/lib/api/balance'
import {
    WALLET_BALANCE_VARIANTS,
    type WalletBalanceVariantId,
} from '../scenarioMetadata'
import type { WalletPreviewState } from '../fixtures/walletBalance'

interface WalletBalanceCandidateProps {
    balance: BalanceResponse
    state: WalletPreviewState
    variant: WalletBalanceVariantId
}

interface CandidateFrameProps {
    children: React.ReactNode
    state: WalletPreviewState
    variant: WalletBalanceVariantId
}

const AVAILABLE_HERO_STYLE = { fontSize: '2rem' } satisfies CSSProperties
const BALANCED_HERO_STYLE = { fontSize: '1.75rem' } satisfies CSSProperties

export default function WalletBalanceCandidate({
    balance,
    state,
    variant,
}: WalletBalanceCandidateProps) {
    const content = (() => {
        switch (variant) {
            case WALLET_BALANCE_VARIANTS.balanceStatement:
                return <BalanceStatement balance={balance} />
            case WALLET_BALANCE_VARIANTS.splitAssets:
                return <SplitAssets balance={balance} />
            case WALLET_BALANCE_VARIANTS.mobileWallet:
                return <MobileWallet balance={balance} />
            case WALLET_BALANCE_VARIANTS.balancedMetrics:
                return <BalancedMetrics balance={balance} />
            default:
                return <AvailableFirst balance={balance} />
        }
    })()

    return (
        <CandidateFrame state={state} variant={variant}>
            {content}
        </CandidateFrame>
    )
}

function CandidateFrame({ children, state, variant }: CandidateFrameProps) {
    return (
        <section
            data-wallet-variant={variant}
            data-wallet-state={state}
            className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-content-line bg-content-surface shadow-sm"
        >
            <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-content-line px-4 py-4 sm:px-6">
                <div className="min-w-0">
                    <p className="break-words text-base font-bold text-content-fg">
                        내 지갑
                    </p>
                    <p className="mt-0.5 text-xs text-content-subtle">
                        게임머니와 캐시 잔액
                    </p>
                </div>
                <button
                    disabled
                    type="button"
                    className="min-h-11 shrink-0 rounded-lg border border-content-line bg-content-soft px-4 text-sm font-bold text-content-subtle disabled:cursor-not-allowed disabled:opacity-60"
                >
                    충전 준비 중
                </button>
            </header>

            {state === 'loading' ? (
                <div
                    role="status"
                    aria-busy="true"
                    aria-label="지갑 잔액을 불러오는 중"
                    className="space-y-3 px-4 py-6 sm:px-6"
                >
                    <div className="h-4 w-24 animate-pulse rounded bg-content-soft" />
                    <div className="h-8 w-2/3 max-w-full animate-pulse rounded-lg bg-content-soft" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="h-16 animate-pulse rounded-lg bg-content-soft" />
                        <div className="h-16 animate-pulse rounded-lg bg-content-soft" />
                        <div className="h-16 animate-pulse rounded-lg bg-content-soft" />
                    </div>
                </div>
            ) : state === 'error' ? (
                <div className="px-4 py-4 sm:px-6 sm:py-6">
                    <div
                        role="alert"
                        className="rounded-xl bg-danger-soft px-4 py-5 text-danger-ink"
                    >
                        <p className="font-bold">
                            지갑 잔액을 불러오지 못했습니다
                        </p>
                        <p className="mt-1 break-words text-xs leading-5">
                            잠시 후 다시 시도하면 안전하게 재조회합니다.
                        </p>
                        <button
                            type="button"
                            className="mt-4 min-h-11 rounded-lg border border-danger bg-content-surface px-4 text-sm font-bold text-danger-ink hover:bg-danger-soft"
                        >
                            다시 시도
                        </button>
                    </div>
                </div>
            ) : (
                children
            )}
        </section>
    )
}

function AvailableFirst({ balance }: { balance: BalanceResponse }) {
    return (
        <div className="w-full min-w-0 max-w-full px-4 py-6 sm:px-6">
            <p className="text-xs font-bold text-content-muted">사용 가능</p>
            <CodeAmount
                value={balance.gameMoneyAvailable}
                mode="full"
                className="mt-1 max-w-full min-w-0 flex-wrap break-all font-bold leading-tight text-content-fg"
                style={AVAILABLE_HERO_STYLE}
            />
            <dl
                data-wallet-metrics="equal-three"
                className="mt-6 grid min-w-0 grid-cols-1 gap-3 border-t border-content-line pt-5 sm:grid-cols-3"
            >
                <Metric label="총 보유" value={balance.gameMoneyBalance} />
                <Metric label="입찰 보류" value={balance.gameMoneyHeld} />
                <Metric
                    label="캐시"
                    value={balance.cashBalance}
                    currency="cash"
                />
            </dl>
        </div>
    )
}

function BalanceStatement({ balance }: { balance: BalanceResponse }) {
    return (
        <div className="w-full min-w-0 max-w-full px-4 py-6 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold text-content-muted">
                        총 보유 잔액
                    </p>
                    <CodeAmount
                        value={balance.gameMoneyBalance}
                        mode="full"
                        className="mt-1 max-w-full min-w-0 flex-wrap break-all text-2xl font-bold text-content-fg"
                    />
                </div>
                <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-ink">
                    구성 합계 일치
                </span>
            </div>
            <dl
                data-wallet-metrics="statement"
                className="mt-6 w-full min-w-0 divide-y divide-content-line border-y border-content-line"
            >
                <StatementRow
                    label="사용 가능"
                    note="즉시 결제·입찰"
                    value={balance.gameMoneyAvailable}
                />
                <StatementRow
                    label="입찰 보류"
                    note="진행 중인 입찰"
                    value={balance.gameMoneyHeld}
                />
                <StatementRow
                    label="캐시"
                    note="충전·교환 자산"
                    value={balance.cashBalance}
                    currency="cash"
                />
            </dl>
        </div>
    )
}

function SplitAssets({ balance }: { balance: BalanceResponse }) {
    return (
        <div className="grid w-full min-w-0 max-w-full grid-cols-1 sm:grid-cols-2">
            <section className="min-w-0 px-4 py-6 sm:px-6">
                <p className="text-xs font-bold text-content-muted">게임머니</p>
                <CodeAmount
                    value={balance.gameMoneyAvailable}
                    mode="full"
                    className="mt-1 max-w-full min-w-0 flex-wrap break-all text-2xl font-bold text-content-fg"
                />
                <dl className="mt-5 space-y-3 border-t border-content-line pt-4">
                    <CompactRow
                        label="총 보유"
                        value={balance.gameMoneyBalance}
                    />
                    <CompactRow
                        label="입찰 보류"
                        value={balance.gameMoneyHeld}
                    />
                </dl>
            </section>
            <section className="min-w-0 border-t border-content-line bg-content-soft px-4 py-6 sm:px-6">
                <p className="text-xs font-bold text-content-muted">
                    캐시 자산
                </p>
                <CodeAmount
                    value={balance.cashBalance}
                    currency="cash"
                    mode="full"
                    className="mt-1 max-w-full min-w-0 flex-wrap break-all text-xl font-bold text-content-fg"
                />
                <p className="mt-3 break-words text-xs leading-5 text-content-subtle">
                    캐시를 게임머니로 교환해 입찰에 사용하세요.
                </p>
                <button
                    type="button"
                    className="mt-4 min-h-11 w-full rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                >
                    게임머니 교환
                </button>
            </section>
        </div>
    )
}

function MobileWallet({ balance }: { balance: BalanceResponse }) {
    return (
        <div className="w-full min-w-0 max-w-full px-4 py-6 sm:px-6">
            <div className="text-center">
                <p className="text-xs font-bold text-content-muted">
                    사용 가능
                </p>
                <CodeAmount
                    value={balance.gameMoneyAvailable}
                    mode="full"
                    className="mt-1 max-w-full min-w-0 flex-wrap justify-center break-all font-bold leading-tight text-content-fg"
                    style={AVAILABLE_HERO_STYLE}
                />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    className="min-h-11 rounded-lg bg-control-action px-4 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                >
                    교환하기
                </button>
                <button
                    disabled
                    type="button"
                    className="min-h-11 rounded-lg border border-content-line bg-content-soft px-4 text-sm font-bold text-content-subtle disabled:cursor-not-allowed disabled:opacity-60"
                >
                    충전 준비 중
                </button>
            </div>
            <dl
                data-wallet-metrics="mobile-stack"
                className="mt-6 divide-y divide-content-line rounded-xl bg-content-soft px-4"
            >
                <StatementRow
                    label="총 보유"
                    value={balance.gameMoneyBalance}
                />
                <StatementRow label="입찰 보류" value={balance.gameMoneyHeld} />
                <StatementRow
                    label="캐시"
                    value={balance.cashBalance}
                    currency="cash"
                />
            </dl>
        </div>
    )
}

function BalancedMetrics({ balance }: { balance: BalanceResponse }) {
    return (
        <div className="flex w-full min-w-0 max-w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-end">
            <section className="min-w-0 flex-1">
                <p className="text-xs font-bold text-content-muted">
                    사용 가능
                </p>
                <CodeAmount
                    value={balance.gameMoneyAvailable}
                    mode="full"
                    className="mt-1 max-w-full min-w-0 flex-wrap break-all font-bold leading-tight text-content-fg"
                    style={BALANCED_HERO_STYLE}
                />
                <p className="mt-2 text-xs text-content-subtle">
                    입찰과 즉시구매에 바로 사용
                </p>
            </section>
            <dl
                data-wallet-metrics="equal-three"
                className="grid min-w-0 flex-1 grid-cols-1 gap-3 border-t border-content-line pt-5 sm:grid-cols-3"
            >
                <Metric label="총 보유" value={balance.gameMoneyBalance} />
                <Metric label="입찰 보류" value={balance.gameMoneyHeld} />
                <Metric
                    label="캐시"
                    value={balance.cashBalance}
                    currency="cash"
                />
            </dl>
        </div>
    )
}

function Metric({
    label,
    value,
    currency,
}: {
    label: string
    value: number
    currency?: 'code' | 'cash'
}) {
    return (
        <div className="min-w-0 rounded-lg bg-content-soft px-3 py-3">
            <dt className="text-xs font-bold text-content-muted">{label}</dt>
            <dd className="mt-1 flex w-full min-w-0">
                <CodeAmount
                    value={value}
                    currency={currency}
                    mode="full"
                    className="w-full max-w-full min-w-0 flex-1 flex-wrap break-all text-xl font-bold text-content-fg"
                />
            </dd>
        </div>
    )
}

function StatementRow({
    label,
    note,
    value,
    currency,
}: {
    label: string
    note?: string
    value: number
    currency?: 'code' | 'cash'
}) {
    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <dt className="min-w-0">
                <span className="block text-xs font-bold text-content-muted">
                    {label}
                </span>
                {note ? (
                    <span className="mt-0.5 block break-words text-xs text-content-subtle">
                        {note}
                    </span>
                ) : null}
            </dt>
            <dd className="min-w-0 max-w-full">
                <CodeAmount
                    value={value}
                    currency={currency}
                    mode="full"
                    className="max-w-full min-w-0 flex-wrap break-all text-base font-bold text-content-fg"
                />
            </dd>
        </div>
    )
}

function CompactRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <dt className="text-xs font-bold text-content-muted">{label}</dt>
            <dd className="min-w-0 max-w-full">
                <CodeAmount
                    value={value}
                    mode="full"
                    className="max-w-full min-w-0 flex-wrap break-all text-sm font-bold text-content-fg"
                />
            </dd>
        </div>
    )
}
