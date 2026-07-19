import { ELEMENT_DOT_CLASS, ELEMENT_LABEL, ELEMENT_TINT_CLASS, toElementKey } from '../lib/element';

/**
 * ElementBadge — design-system [5.8] + [2.7] 라이트 패턴.
 *
 * 라이트에서 element 4색은 흰 배경 위 텍스트로 쓰면 전건 무너진다(water 2.37). 그래서 역할을 반전한다:
 * **소프트 틴트 배경 + near-black 라벨(7.4~9.3:1) + solid element 도트**. 속성명 텍스트를 항상 병기해
 * 색 단독 전달을 피한다(accessibility [2]).
 *
 * Game-Color Containment([1.2]) — 아이템 카드·속성 배지·아이템 필터 칩 밖에서 쓰지 않는다.
 */
export function ElementBadge({ element }: { element: number }) {
  const key = toElementKey(element);

  // 미등록 코드: 색을 지어내지 않고 중립 칩으로 폴백한다(코드 노출 = 무음 실패 방지).
  if (!key) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-surface-sunken px-2 py-0.5 text-label text-text-muted">
        속성 {element}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-label text-on-accent-fg ${ELEMENT_TINT_CLASS[key]}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${ELEMENT_DOT_CLASS[key]}`}
        aria-hidden="true"
      />
      {ELEMENT_LABEL[key]}
    </span>
  );
}
