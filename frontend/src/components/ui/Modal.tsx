import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Modal / Dialog — design-system [5.5].
 * role=dialog · aria-modal · 포커스 트랩 · 첫 포커스 이동 · Esc 닫기 · 닫을 때 트리거로 복귀 · aria-labelledby.
 * surface-raised 패널 + shadow-lg 부양(라이트 베이스 — 그림자가 부양을 만든다).
 */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, titleId, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // 열릴 때 트리거 저장 후 패널 첫 포커스로 이동
    triggerRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!firstEl || !lastEl) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // 닫힐 때 트리거로 포커스 복귀
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border bg-surface-raised p-6 shadow-lg"
      >
        {/* 다이얼로그 제목은 값 축이다([3.2] `text-value`) — 페이지 제목(`text-title`)을 빌려 쓰지 않는다. */}
        <h2 id={titleId} className="text-value font-bold text-text">
          {title}
        </h2>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
