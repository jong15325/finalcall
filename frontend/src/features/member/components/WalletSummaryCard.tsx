import { Link } from 'react-router'
import { TbChevronRight, TbWallet } from 'react-icons/tb'
import { paths } from '@/app/paths'
import CodeAmount from '@/components/common/CodeAmount'
import type { BalanceResponse } from '@/lib/api/balance'

/**
 * 지갑 summary 카드 (FC-074 — 목업 `.account-wallet-card`) · design-brief B-7/B-8.
 *
 * ★ `GET /me/balance` 의 **세 값을 그대로** 보여준다(`balance.ts` 규칙 — 뭉개지 않는다):
 *   `gameMoneyAvailable`(사용 가능·강조) · `gameMoneyBalance`(총 보유) · `gameMoneyHeld`(입찰 보류).
 * ★ **충전 = 자리보류**(`/charges` 미구현, §5) → `disabled` DOM 속성(색만 X). 미구현 엔드포인트를
 *   호출하지 않는다. "지갑 자세히" 는 `/me/wallet`(FC-075)로 이동 — 실연동 라우트라 링크 허용.
 * ★ 금액은 CodeAmount(정수·full) — 마이페이지는 자산 확인 맥락이라 축약 아닌 원본 표기.
 */

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
        <section className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-gold-bright">
                    <TbWallet aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900">지갑</h3>
                    <p className="text-xs text-gray-500">
                        사용 가능한 게임머니
                    </p>
                </div>
                {/* 충전 — 준비 중 자리(미구현·미호출). DOM 속성으로 비활성 전달 */}
                <button
                    disabled
                    type="button"
                    aria-disabled="true"
                    title="충전은 준비 중입니다"
                    className="ms-auto rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400"
                >
                    충전 준비 중
                </button>
            </div>

            {isLoading ? (
                <div
                    aria-hidden
                    className="mt-4 h-8 w-40 animate-pulse rounded bg-gray-100"
                />
            ) : isError ? (
                <p className="mt-4 text-sm text-gray-500">
                    잔액을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
            ) : (
                <>
                    <CodeAmount
                        value={balance?.gameMoneyAvailable ?? null}
                        mode="full"
                        className="mt-4 text-2xl font-bold text-gray-900"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1 text-gray-500">
                            총 보유
                            <CodeAmount
                                value={balance?.gameMoneyBalance ?? null}
                                mode="full"
                                className="font-semibold text-gray-700"
                            />
                        </span>
                        <span className="flex items-center gap-1 text-warning">
                            입찰 보류
                            <CodeAmount
                                value={balance?.gameMoneyHeld ?? null}
                                mode="full"
                                className="font-semibold"
                            />
                        </span>
                    </div>
                </>
            )}

            <Link
                to={paths.wallet}
                className="mt-4 inline-flex items-center gap-1 self-start text-sm font-semibold text-navy hover:text-orange-deep"
            >
                지갑 자세히
                <TbChevronRight aria-hidden className="size-4" />
            </Link>

            <p className="mt-3 text-xs text-gray-400">
                판매 수수료는 낙찰가 구간별 누진(6~3%)이며 구매자는 무료입니다.
            </p>
        </section>
    )
}

export default WalletSummaryCard
