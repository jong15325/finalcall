import ExchangeForm from '@/features/member/components/ExchangeForm'
import WalletBalanceCard from '@/features/member/components/WalletBalanceCard'
import { useMyBalance } from '@/lib/queries/balance'
import { useExchange } from '@/lib/queries/exchange'

/**
 * 지갑 `/me/wallet` (FC-075 — 목업 `.wallet-grid`(balance + exchange) · design-brief B-8).
 *
 * ★ 실연동은 **계약이 준 것만**: `GET /me/balance`(잔액 4필드) · `POST /exchanges`(교환).
 * ★ **충전은 미구현·자리보류**(`/charges` 없음, §5) — 잔액 카드의 "충전 준비 중" 비활성 버튼으로만.
 * ★ 교환 성공 시 `useExchange` 가 `balanceKeys.me()` 를 무효화 → 잔액 카드가 즉시 새 값을 반영한다.
 * ★ 레이아웃: 목업 `.wallet-grid`(1.5fr 잔액 카드 + 1fr 교환 폼). 모바일은 1열로 쌓는다.
 */
export default function WalletPage() {
    const balanceQuery = useMyBalance()
    const exchangeMutation = useExchange()

    return (
        <div className="flex flex-col gap-4">
            <header>
                <h1 className="text-2xl font-bold text-gray-900">지갑</h1>
                <p className="mt-1 text-sm text-gray-500">
                    캐시와 게임머니, 입찰 중 보류 금액을 구분해 확인하세요.
                </p>
            </header>

            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <WalletBalanceCard
                    balance={balanceQuery.data}
                    isLoading={balanceQuery.isPending}
                    isError={balanceQuery.isError}
                />
                <ExchangeForm
                    cashBalance={balanceQuery.data?.cashBalance}
                    isSubmitting={exchangeMutation.isPending}
                    submitError={exchangeMutation.error}
                    result={exchangeMutation.data}
                    onExchange={(cashAmount) =>
                        exchangeMutation.mutate(cashAmount)
                    }
                />
            </div>
        </div>
    )
}
