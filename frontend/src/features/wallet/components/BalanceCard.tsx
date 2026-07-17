import { ErrorState } from '@/components/feedback/ErrorState';
import { MoneyAmount } from '@/components/ui/MoneyAmount';
import { useBalance } from '../api/useWallet';

/**
 * 잔액 카드 (FC-015, spec §3.3 B). GET /me/balance 4필드 표시(표시만 — 충전·교환 버튼 없음).
 * 탈퇴 Modal 이 같은 useBalance 쿼리를 공유(키 동일 → 캐시 재사용).
 */
export function BalanceCard() {
  const { data, isLoading, isError, error, refetch } = useBalance();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-bold text-text">잔액</h2>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4" aria-busy="true" aria-live="polite">
          <span className="sr-only">잔액 불러오는 중</span>
          <div className="h-14 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-14 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-14 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-14 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data ? (
        <div className="grid grid-cols-2 gap-4">
          <MoneyAmount label="캐시" amount={data.cashBalance} unit="캐시" />
          <MoneyAmount label="게임머니" amount={data.gameMoneyBalance} unit="G" />
          <MoneyAmount label="홀드(사용 중)" amount={data.gameMoneyHeld} unit="G" tone="warning" />
          <MoneyAmount label="가용 잔액" amount={data.gameMoneyAvailable} unit="G" size="lg" />
        </div>
      ) : null}
    </section>
  );
}
