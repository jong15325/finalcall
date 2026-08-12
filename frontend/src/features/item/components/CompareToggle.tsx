/**
 * CompareToggle — 카드 비교 담기 토글 (FC-068).
 *
 * ★ **여기선 토글 UI·콜백 props 만** 소유한다. 선택 상태 저장·플로팅 비교 바는 FC-077(비교) 소유다
 *   — 이 컴포넌트는 controlled(`pressed`/`onToggle`) 다.
 * ★ 선택/비활성은 **DOM 속성**으로 표현한다 — `aria-pressed`·`disabled`. opacity 만으로 상태를
 *   표시하지 않는다(보조기술에 활성으로 새는 WCAG 4.1.2 회귀 방지). 선택은 테두리·배경·체크로 알린다.
 * ★ 카드 위 오버레이로 얹히되 이미지 크기를 바꾸지 않는다(ItemFrame `overlay` 층에 렌더).
 * ★ **아이콘 전용 배지** — 포인터 hit area 는 WCAG 권고에 맞춘 44px, 아이콘은 15px를 유지한다.
 *   아이템 이미지 모서리에 얹으며 의미는 `aria-label` 로 전달한다.
 */
import { TbColumns3 } from 'react-icons/tb'

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
    // 목업 `.compare-toggle`: 선택/hover 는 브랜드 오렌지, 기본은 다크 반투명 유리(§2.9).
    const stateClass = pressed
        ? 'border-content-fg bg-control-action text-content-fg'
        : 'border-on-strong/60 bg-chrome-strong/75 text-on-strong hover:border-content-fg hover:bg-control-action hover:text-content-fg'

    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            disabled={disabled}
            className={`inline-grid size-11 place-items-center rounded-[9px] border shadow-[var(--shadow-control)] backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:border-content-line disabled:bg-content-soft disabled:text-content-subtle ${stateClass} ${className}`.trim()}
            onClick={() => onToggle(!pressed)}
        >
            <TbColumns3 aria-hidden="true" className="size-[15px]" />
        </button>
    )
}

export default CompareToggle
