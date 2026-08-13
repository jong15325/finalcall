import { Link } from 'react-router'
import { TbWallet } from 'react-icons/tb'
import { paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import type { BalanceResponse } from '@/lib/api/balance'

/** 마이페이지 지갑 요약. 상세와 같은 모바일 월렛형 위계로 네 잔액을 빠르게 스캔한다. */
interface WalletSummaryCardProps {
    balance: BalanceResponse | undefined
    isLoading: boolean
    isError: boolean
}

function WalletSummaryCard({
    balance,
    isLoading,
    isError,
}: WalletSummaryCardProps) {
    return (
        <section className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-content-line bg-content-surface">
            <header className="flex min-w-0 items-center gap-3 border-b border-content-line px-4 py-4 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-structure text-brand-highlight-bright">
                    <TbWallet aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-content-fg">
                        지갑
                    </h3>
                    <p className="text-xs text-content-subtle">
                        게임머니와 캐시 잔액
                    </p>
                </div>
            </header>

            {isLoading ? (
                <div
                    role="status"
                    aria-label="지갑 잔액을 불러오는 중"
                    className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6"
                >
                    <div className="mx-auto h-9 w-48 max-w-full animate-pulse rounded bg-content-soft" />
                    <div className="h-32 animate-pulse rounded-xl bg-content-soft" />
                </div>
            ) : isError || !balance ? (
                <div className="flex-1 px-4 py-6 sm:px-6">
                    <p role="alert" className="text-sm text-content-subtle">
                        잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                    </p>
                </div>
            ) : (
                <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6">
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
                        <Link
                            to={paths.wallet}
                            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-control-action px-3 text-sm font-bold text-control-action-ink hover:bg-control-action-hover"
                        >
                            지갑 자세히
                        </Link>
                        <button
                            disabled
                            type="button"
                            aria-disabled="true"
                            title="충전은 준비 중입니다"
                            className="min-h-11 rounded-lg border border-content-line bg-content-soft px-3 text-sm font-bold text-content-subtle disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            충전 준비 중
                        </button>
                    </div>

                    <dl className="mt-6 divide-y divide-content-line rounded-xl bg-content-soft px-4">
                        <SummaryRow
                            label="총 보유"
                            value={balance.gameMoneyBalance}
                        />
                        <SummaryRow
                            label="입찰 보류"
                            value={balance.gameMoneyHeld}
                        />
                        <SummaryRow
                            currency="cash"
                            label="캐시"
                            value={balance.cashBalance}
                        />
                    </dl>

                    <p className="mt-4 break-words text-xs leading-5 text-content-subtle">
                        판매 수수료는 낙찰가 구간별 누진(6~3%)이며 구매자는
                        무료입니다.
                    </p>
                </div>
            )}
        </section>
    )
}

function SummaryRow({
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
            <dd className="min-w-0 max-w-full">
                <CodeAmount
                    currency={currency}
                    value={value}
                    mode="full"
                    className="max-w-full min-w-0 flex-wrap break-all text-base font-bold"
                />
            </dd>
        </div>
    )
}

export default WalletSummaryCard
