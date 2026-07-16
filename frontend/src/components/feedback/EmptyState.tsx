import type { ReactNode } from 'react';

/**
 * 공통 빈 상태 골격. 안내 + CTA 슬롯만 제공(카피·아이콘은 feature 단계).
 * screen-spec [3] 공통: 빈 상태(안내+CTA).
 */
export function EmptyState({
  title = '표시할 내용이 없습니다',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-10 text-center">
      <p className="text-lg font-semibold text-text">{title}</p>
      {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
