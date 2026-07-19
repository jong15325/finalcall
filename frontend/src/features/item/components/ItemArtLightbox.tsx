import { useEffect, useRef } from 'react';
import { elementLabelOf } from '../lib/element';
import { goldforceStateOf } from '../lib/goldforce';
import { itemTypeLabel } from '../lib/itemCode';
import { ItemArtSlot } from './ItemArtSlot';
import type { ItemBlock } from '@/types/schema';

/**
 * 아트 확대 라이트박스 — design-system [5.5] + references [5-1]·[6-1].
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★ **게임 카드정보 모달은 폐기했다. 이건 아트를 크게 보여주는 역할만 한다.**
 *   · Baymard([5-1]): **스펙 중심 상품에 퀵뷰를 만들지 마라.** 속성이 많아 오버레이에 다 들어가지
 *     않고 사용자는 결국 무시한다. 211×307 창에 스펙을 다 넣으려던 건 **원본의 제약을 상속**한 것이지
 *     우리의 요구가 아니다.
 *   · D2R 계승/답습 판정([6-1]): 남색 배경·금색 타이틀·점선·고정 비율은 전부 **답습**이고,
 *     계승 대상은 **세로 카드 아트 그 자체**뿐이다. "계승 대상은 아트이지 창(chrome)이 아니다."
 * → 스펙·탭·거래 액션을 넣지 않는다. 크롬은 100% 라이트 커머스이고 게임색은 아트 슬롯 안에만 있다.
 *
 * ★ 모바일은 **중앙 모달이 아니라 바텀시트**다([5-4]). 그리고 시트 안에서 **아트를 세로로 쌓지
 *   않는다** — 세로형 아트라 시트가 불필요하게 높아진다. 가로 배치(상세 상단과 같은 언어)를 쓴다.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 접근성([5.5]): role=dialog · aria-modal · 첫 포커스 이동 · 포커스 트랩 · Esc 닫기 ·
 * 닫을 때 트리거로 복귀 · aria-labelledby. 시트를 겹쳐 쌓지 않는다.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export function ItemArtLightbox({
  item,
  open,
  onClose,
}: {
  item: ItemBlock;
  open: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const goldforce = goldforceStateOf(item.goldforceExpireAt);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,18,25,0.66)] sm:items-center sm:px-4 sm:py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="art-lightbox-title"
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-xl bg-surface shadow-lg sm:max-h-[90vh] sm:max-w-[560px] sm:rounded-xl"
      >
        {/* 모바일 그랩 핸들 — 시트임을 형태로 알린다([5-4] NN/g). */}
        <div
          className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong sm:hidden"
          aria-hidden="true"
        />

        <div className="flex items-center gap-3 border-b border-border-muted py-3 pl-6 pr-3">
          <h2 id="art-lightbox-title" className="text-value text-text">
            카드 아트
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto grid h-11 w-11 flex-none place-items-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-text"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* 세로형 아트라 모바일은 가로 배치가 시트 높이를 낮춘다. 데스크톱은 세로 스택. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5 p-5 sm:grid-cols-1 sm:gap-0 sm:p-6">
          <div className="overflow-hidden rounded-lg">
            <ItemArtSlot item={item} variant="lightbox" />
          </div>

          {/* 정체성 한 줄 — **스펙이 아니다.** 스펙은 페이지가 이미 전부 보여준다. */}
          <div className="sm:mt-5 sm:text-center">
            <p className="text-value font-extrabold text-text">{item.nameSnapshot}</p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-body text-text-muted sm:justify-center">
              <span>{itemTypeLabel(item.subGroup, item.kind)}</span>
              <span aria-hidden="true">·</span>
              <span>{elementLabelOf(item.element)} 속성</span>
              <span aria-hidden="true">·</span>
              <span className="font-num">Lv.{item.level}</span>
              {goldforce.active ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>골드포스 {goldforce.remainingLabel} 남음</span>
                </>
              ) : null}
            </p>
          </div>

          <p className="col-span-2 border-t border-border-muted pt-4 text-micro leading-relaxed text-text-subtle sm:col-span-1 sm:mt-5 sm:text-center">
            원본 카드 아트를 정수배로 확대했습니다. 레벨 표기는 아트에 포함돼 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
