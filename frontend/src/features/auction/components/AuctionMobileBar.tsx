import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import { bidCtaLabelFor, formatVerbose } from '@/lib/countdown';
import type { CountdownPhase } from '@/lib/countdown';
import { formatMoney } from '@/lib/format';
import type { AuctionDetail } from '@/types/schema';

/**
 * 모바일 하단 고정 바 — references [4-1]·[4-4]·[8-3].
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **같은 바를 좁혀 접은 것이 아니다. 역할을 넘겨받은 다른 컴포넌트다.**
 * 데스크톱에서 상시 노출을 담당하던 sticky 바는 좁은 폭에서 화면 상단을 너무 많이 먹는다.
 * 모바일은 **하단 fixed 바**가 그 역할을 맡고, 담는 것도 3개로 줄인다 — 현재가 · 잔여시간 · CTA.
 *
 * [8-3]이 못 박은 구현 규칙을 그대로 지킨다:
 *   · `IntersectionObserver` 로 본문 입찰 바를 관측한다. **스크롤 리스너·픽셀 임계값 금지.**
 *   · `transform` + `opacity` 만 애니메이션한다. **`height`/`top` 금지**(CLS).
 *   · 페이지 하단에 바 높이만큼 패딩을 **미리 확보**한다(상세 페이지가 `pb-28` 로 잡는다).
 *   · 탭 타깃 44×44 이상.
 *   · 나타날 때 **포커스를 빼앗지 않는다** — 시각 요소일 뿐이라 `aria-hidden` 이 아니라 그냥
 *     조용히 등장한다. 본문 바가 보일 때는 DOM 에서 내려 중복 읽기를 막는다.
 *   · **본문 값과 바의 값이 어긋나지 않게 단일 시계에서 구독한다** — 상세가 `useCountdown` 을
 *     한 번만 호출해 `phase`·`remaining` 을 양쪽에 내려보낸다(이 컴포넌트는 자체 타이머가 없다).
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function AuctionMobileBar({
  auction,
  phase,
  remaining,
  ended,
  observeRef,
}: {
  auction: AuctionDetail;
  phase: CountdownPhase;
  remaining: number;
  ended: boolean;
  /** 본문 입찰 바. 이 요소가 뷰포트를 벗어나면 하단 바가 뜬다. */
  observeRef: RefObject<HTMLElement>;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = observeRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => setShown(entries.every((entry) => !entry.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [observeRef]);

  const hasBid = auction.highestBidAmount != null;
  const amount = hasBid ? (auction.highestBidAmount as number) : auction.startPrice;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.10)] transition-[transform,opacity] duration-base lg:hidden ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
      // 본문 바가 보이는 동안에는 같은 값이 두 번 읽히므로 보조기술에서 숨긴다.
      aria-hidden={!shown}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <span className="block font-num text-value font-extrabold text-text">
            {formatMoney(amount)}
            <span className="ml-0.5 text-micro font-medium text-text-muted">G</span>
          </span>
          <span
            className={`mt-0.5 block font-num text-micro font-bold ${
              phase === 'urgent' ? 'text-danger' : 'text-text-muted'
            }`}
          >
            {ended ? '마감됨' : formatVerbose(remaining)}
          </span>
        </div>
        <Button variant="primary" size="lg" disabled className="min-w-[130px] flex-none">
          {ended ? '마감됨' : bidCtaLabelFor(phase)}
        </Button>
      </div>
    </div>
  );
}
