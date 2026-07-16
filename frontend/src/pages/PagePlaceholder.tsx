import { useParams } from 'react-router-dom';

/**
 * 라우트 placeholder (skeleton-plan [3] — 전 라우트 빈 placeholder).
 * 도메인 구현은 각 feature 단계에서 이 자리를 대체한다. 도메인 지식을 여기 넣지 않는다.
 */
export function PagePlaceholder({ title }: { title: string }) {
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([, value]) => value !== undefined);

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">
        스켈레톤 placeholder — feature 단계에서 구현됩니다.
      </p>
      {paramEntries.length > 0 ? (
        <dl className="mt-4 space-y-1 text-xs text-text-subtle">
          {paramEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="font-medium">{key}</dt>
              <dd className="font-num">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
