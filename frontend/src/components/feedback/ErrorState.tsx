import { isApiError } from '@/lib/api/errors';

/**
 * 공통 에러 상태 골격. 계약 [5] ErrorCode 를 표면화하되, 코드→카피 매핑은 feature 단계.
 * 여기서는 code·message 노출과 재시도 훅만 제공한다(카피 없음).
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const code = isApiError(error) ? error.code : 'UNKNOWN';
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';

  return (
    <div
      className="flex flex-col items-center gap-3 p-10 text-center"
      role="alert"
      aria-live="assertive"
    >
      <p className="text-value text-danger">문제가 발생했습니다</p>
      <p className="text-body text-text-muted">{message}</p>
      <p className="text-micro text-text-subtle">코드: {code}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-border-strong px-4 py-2 text-body text-text transition-colors duration-fast hover:bg-surface-sunken"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
