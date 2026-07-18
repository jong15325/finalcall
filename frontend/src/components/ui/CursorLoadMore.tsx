import { useEffect, useRef } from 'react';
import { Button } from './Button';

/**
 * CursorLoadMore — design-system [5.7] cursor 페이지네이션.
 *
 * 센티넬 관찰(무한스크롤) + **"더 보기" 폴백 버튼**. 버튼은 숨기지 않는다 — 센티넬 교차는 키보드·스크린리더
 * 사용자에게 도달 수단이 아니기 때문이다(accessibility [3] "더 보기·센티넬은 키보드/SR 로 다음 페이지 로드 가능").
 * `hasNext=false` 면 종료를 텍스트로 표시한다.
 */
interface CursorLoadMoreProps {
  hasNext: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  /** 목록 끝 안내 문구. 빈 목록에서는 상위가 빈 상태를 그리므로 호출하지 않는다. */
  endLabel?: string;
}

export function CursorLoadMore({
  hasNext,
  isLoading,
  onLoadMore,
  endLabel = '마지막 매물입니다',
}: CursorLoadMoreProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNext || isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNext, isLoading, onLoadMore]);

  if (!hasNext) {
    return (
      <p className="py-8 text-center text-sm text-text-subtle" role="status">
        {endLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <div ref={sentinel} aria-hidden="true" className="h-px w-full" />
      <Button variant="outline" onClick={onLoadMore} isLoading={isLoading}>
        {isLoading ? '불러오는 중' : '더 보기'}
      </Button>
    </div>
  );
}
