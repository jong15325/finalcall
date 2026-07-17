/**
 * 공통 로딩 상태 골격 (skeleton). 각 화면 카피·구체 스켈레톤은 feature 단계.
 * design-system [5.3] loading = 스켈레톤 블록.
 */
export function LoadingState({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3 p-6" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-4 w-1/3 animate-pulse rounded-sm bg-surface-sunken" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-surface-sunken" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-surface-sunken" />
    </div>
  );
}
