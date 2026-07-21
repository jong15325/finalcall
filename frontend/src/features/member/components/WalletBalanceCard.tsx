import { TbWallet } from 'react-icons/tb'
import CodeAmount from '@/components/common/CodeAmount'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 지갑 잔액 카드 (FC-075 — 목업 `.wallet-balance-card` + `.hold-meter`) · design-brief B-8.
 *
 * ★ `GET /me/balance` 의 **네 값을 그대로** 보여준다(`balance.ts` 규칙 — 뭉개지 않는다):
 *   `gameMoneyAvailable`(사용 가능·hero) · `gameMoneyBalance`(총 보유) · `gameMoneyHeld`(입찰 보류) ·
 *   `cashBalance`(캐시). 가용액을 "보유"로 부르면 잔액을 축소해 보이게 한다.
 * ★ **입찰 보류 = `.hold-meter` 바**(홀드/총 비율). 색 단독 정보 금지 → 바 옆에 "입찰 중 묶인 금액"
 *   문구와 CodeAmount 를 동반한다(접근성). 총 보유 0 이면 비율 0%.
 * ★ **충전 = 자리보류**(`/charges` 미구현, §5) → `disabled` DOM 속성(클래스만 X). 미구현
 *   엔드포인트를 호출하지 않는다. 캐시를 채울 경로가 없으므로 안내만 남긴다.
 * ★ 금액은 CodeAmount(정수·full) — 지갑은 거래 확정 맥락이라 축약 아닌 원본 표기.
 */

interface WalletBalanceCardProps {
    balance: BalanceResponse | undefined
    isLoading: boolean
    isError: boolean
}

/** 홀드 비율(%) — 총 보유 대비 입찰 보류. 0~100 클램프, 총 0 이면 0. */
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
        <section className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-bright">
                    <TbWallet aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h2 className="text-base font-bold text-gray-900">
                        게임머니
                    </h2>
                    <p className="text-xs text-gray-500">
                        사용 가능한 금액과 입찰 중 묶인 금액을 구분해
                        확인하세요.
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div aria-hidden className="mt-5 flex flex-col gap-3">
                    <div className="h-9 w-48 animate-pulse rounded bg-gray-100" />
                    <div className="h-2 w-full animate-pulse rounded bg-gray-100" />
                </div>
            ) : isError || !balance ? (
                <p className="mt-5 text-sm text-gray-500">
                    잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
            ) : (
                <>
                    {/* 사용 가능 게임머니 — hero */}
                    <div className="mt-5">
                        <span className="text-xs font-semibold text-gray-500">
                            사용 가능 게임머니
                        </span>
                        <CodeAmount
                            value={balance.gameMoneyAvailable}
                            mode="full"
                            className="mt-1 text-3xl font-bold text-gray-900"
                        />
                    </div>

                    {/* 총 보유 / 입찰 보류 */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-500">
                            총 보유
                            <CodeAmount
                                value={balance.gameMoneyBalance}
                                mode="full"
                                className="font-semibold text-gray-700"
                            />
                        </span>
                        <span className="flex items-center gap-1.5 text-warning">
                            입찰 보류
                            <CodeAmount
                                value={balance.gameMoneyHeld}
                                mode="full"
                                className="font-semibold"
                            />
                        </span>
                    </div>

                    {/* 홀드 미터 — 홀드/총 비율. 색 단독 금지 → 값/문구 동반 */}
                    <div
                        role="progressbar"
                        aria-label="입찰 보류 비율"
                        aria-valuenow={Math.round(percent)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100"
                    >
                        <div
                            className="h-full rounded-full bg-warning transition-[width]"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    {hasHold && (
                        <p className="mt-2 text-xs text-gray-500">
                            입찰 중 묶인 금액은 낙찰·유찰이 확정되면 풀립니다.
                        </p>
                    )}

                    {/* 캐시 잔액 + 충전 자리보류 */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-gray-500">
                                캐시 잔액
                            </span>
                            <CodeAmount
                                value={balance.cashBalance}
                                mode="full"
                                className="mt-0.5 text-lg font-bold text-gray-800"
                            />
                        </div>
                        {/* 충전 — 준비 중 자리(미구현·미호출). DOM 속성으로 비활성 전달 */}
                        <button
                            disabled
                            type="button"
                            aria-disabled="true"
                            title="캐시 충전은 준비 중입니다"
                            className="shrink-0 rounded-lg bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-400"
                        >
                            충전 준비 중
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        캐시 충전은 아직 연결되지 않았습니다. 보유 캐시로
                        게임머니를 교환할 수 있습니다.
                    </p>
                </>
            )}
        </section>
    )
}

export default WalletBalanceCard
