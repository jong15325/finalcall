/**
 * CompareToggle — 카드 비교 담기 토글 (FC-068).
 *
 * ★ **여기선 토글 UI·콜백 props 만** 소유한다. 선택 상태 저장·플로팅 비교 바는 FC-077(비교) 소유다
 *   — 이 컴포넌트는 controlled(`pressed`/`onToggle`) 다.
 * ★ 선택/비활성은 **DOM 속성**으로 표현한다 — `aria-pressed`·`disabled`. opacity 만으로 상태를
 *   표시하지 않는다(보조기술에 활성으로 새는 WCAG 4.1.2 회귀 방지). 선택은 테두리·배경·체크로 알린다.
 * ★ 카드 위 오버레이로 얹히되 이미지 크기를 바꾸지 않는다(ItemFrame `overlay` 층에 렌더).
 */

interface CompareToggleProps {
    /** 현재 선택 여부(controlled) */
    pressed: boolean
    /** 다음 선택값을 콜백으로 올린다(상태는 상위가 소유) */
    onToggle: (next: boolean) => void
    /** 접근성 라벨. 기본 "비교 담기" */
    label?: string
    disabled?: boolean
    className?: string
}

function CompareToggle({
    pressed,
    onToggle,
    label = '비교 담기',
    disabled = false,
    className = '',
}: CompareToggleProps) {
    const stateClass = pressed
        ? 'border-orange bg-orange-subtle text-orange-deep'
        : 'border-line bg-surface/90 text-gray-600 hover:border-orange hover:text-orange-deep'

    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            disabled={disabled}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold shadow-sm backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-gray-100 disabled:text-gray-400 xs:text-xs ${stateClass} ${className}`.trim()}
            onClick={() => onToggle(!pressed)}
        >
            <span aria-hidden="true">{pressed ? '✓ 비교' : '비교'}</span>
        </button>
    )
}

export default CompareToggle
