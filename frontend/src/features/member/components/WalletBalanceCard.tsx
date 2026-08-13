import { TbWallet } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 지갑 상세 카드. 승인된 모바일 월렛형 위계로 잔액 4값과 교환·충전 행동을 한 흐름에 둔다.
 * 입찰 보류는 총 보유 대비 progress와 설명을 유지하고, 미구현 충전은 DOM disabled로 전달한다.
 */
interface WalletBalanceCardProps {
    balance: BalanceResponse | undefined
    isLoading: boolean
    isError: boolean
}

function holdPercent(held: number, total: number): number {
    if (!Number.isFinite(held) || !Number.isFinite(total) || total <= 0)
        return 0
    return Math.min(100, Math.max(0, (held / total) * 100))
}

function WalletBalanceCard({
    balance,
    isLoading,
    isError,
}: WalletBalanceCardProps) {
    const hasHold = (balance?.gameMoneyHeld ?? 0) > 0
    const percent = balance
        ? holdPercent(balance.gameMoneyHeld, balance.gameMoneyBalance)
        : 0

    return (
        <section
            data-testid="wallet-balance-card"
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-content-line bg-content-surface"
        >
            <header className="flex min-w-0 items-center gap-3 border-b border-content-line px-4 py-4 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-structure text-brand-highlight-bright">
                    <TbWallet aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-content-fg">
                        내 지갑
                    </h2>
                    <p className="text-xs text-content-subtle">
                        게임머니와 캐시 잔액
                    </p>
                </div>
            </header>

            {isLoading ? (
                <div
                    role="status"
                    aria-label="지갑 잔액을 불러오는 중"
                    className="flex flex-col gap-4 px-4 py-6 sm:px-6"
                >
                    <div className="mx-auto h-9 w-48 max-w-full animate-pulse rounded bg-content-soft" />
                    <div className="grid grid-cols-2 gap-2">
                        <div className="h-11 animate-pulse rounded-lg bg-content-soft" />
                        <div className="h-11 animate-pulse rounded-lg bg-content-soft" />
                    </div>
                    <div className="h-40 animate-pulse rounded-xl bg-content-soft" />
                </div>
            ) : isError || !balance ? (
                <div className="px-4 py-6 sm:px-6">
                    <p role="alert" className="text-sm text-content-subtle">
                        잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </p>
                </div>
            ) : (
                <div className="w-full min-w-0 px-4 py-6 sm:px-6">
                    <div className="min-w-0 text-center">
                        <p className="text-xs font-bold text-content-muted">
                            사용 가능
                        </p>
                        <CodeAmount
                            value={balance.gameMoneyAvailable}
                            mode="full"
                            className="mt-1 max-w-full min-w-0 flex-wrap justify-center break-all text-[2rem] font-bold leading-tight"
                        />
                    </div>

                    <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-2">
                        <a
                            href="#exchange-form"
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-control-action px-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                        >
                            교환하기
                        </a>
                        <button
                            disabled
                            type="button"
                            aria-disabled="true"
                            title="캐시 충전은 준비 중입니다"
                            className="min-h-11 rounded-lg border border-content-line bg-content-soft px-3 text-sm font-bold text-content-subtle disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            충전 준비 중
                        </button>
                    </div>

                    <dl className="mt-6 divide-y divide-content-line rounded-xl bg-content-soft px-4">
                        <WalletRow
                            label="총 보유"
                            value={balance.gameMoneyBalance}
                        />
                        <WalletRow
                            label="입찰 보류"
                            value={balance.gameMoneyHeld}
                        />
                        <WalletRow
                            currency="cash"
                            label="캐시"
                            value={balance.cashBalance}
                        />
                    </dl>

                    <div
                        role="progressbar"
                        aria-label="입찰 보류 비율"
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={Math.round(percent)}
                        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-content-soft"
                    >
                        <div
                            className="h-full rounded-full bg-warning transition-[width]"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    {hasHold ? (
                        <p className="mt-2 break-words text-xs leading-5 text-content-subtle">
                            입찰 중 묶인 금액은 낙찰·유찰이 확정되면 정산됩니다.
                        </p>
                    ) : null}
                </div>
            )}
        </section>
    )
}

function WalletRow({
    currency = 'code',
    label,
    value,
}: {
    currency?: 'code' | 'cash'
    label: string
    value: number
}) {
    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
            <dt className="text-xs font-bold text-content-muted">{label}</dt>
            <dd data-wallet-supporting-amount className="min-w-0 max-w-full">
                <CodeAmount
                    currency={currency}
                    value={value}
                    mode="full"
                    className="max-w-full min-w-0 flex-wrap break-all text-xl font-bold"
                />
            </dd>
        </div>
    )
}

export default WalletBalanceCard
