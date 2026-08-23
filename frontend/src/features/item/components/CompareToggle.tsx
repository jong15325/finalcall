/**
 * CompareToggle — 카드 비교 담기 토글 (FC-068).
 *
 * ★ **여기선 토글 UI·콜백 props 만** 소유한다. 선택 상태 저장·플로팅 비교 바는 FC-077(비교) 소유다
 *   — 이 컴포넌트는 controlled(`pressed`/`onToggle`) 다.
 * ★ 선택/비활성은 **DOM 속성**으로 표현한다 — `aria-pressed`·`disabled`. opacity 만으로 상태를
 *   표시하지 않는다(보조기술에 활성으로 새는 WCAG 4.1.2 회귀 방지). 선택은 테두리·배경·체크로 알린다.
 * ★ 카드 위 오버레이로 얹히되 이미지 크기를 바꾸지 않는다(ItemFrame `overlay` 층에 렌더).
 * ★ 아이콘과 짧은 상태 라벨을 함께 표시해 카드 위에서도 목적과 선택 여부를 즉시 읽게 한다.
 *   포인터 hit area 는 WCAG 권고에 맞춘 최소 44px를 유지한다.
 */
import { TbCheck, TbLayersIntersect } from 'react-icons/tb'
import './CompareToggle.css'

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
    return (
        <button
            type="button"
            aria-pressed={pressed}
            aria-label={label}
            disabled={disabled}
            className={`compare-toggle ${className}`.trim()}
            onClick={() => onToggle(!pressed)}
        >
            {pressed ? (
                <TbCheck aria-hidden />
            ) : (
                <TbLayersIntersect aria-hidden />
            )}
        </button>
    )
}

export default CompareToggle
