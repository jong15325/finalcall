import { useId } from 'react'
import classNames from '@/utils/classNames'

/**
 * 단일 선택 필터 칩 묶음 (FC-059).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **왜 템플릿 `Segment` 를 쓰지 않았는가 — 320px 에서 넘친다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * `_segment.css` 는 `.segment { @apply inline-flex ... }` + `.segment-item { px-5 }` 다.
 * **줄바꿈이 없고 항목마다 좌우 40px 여백**이 붙는다. 속성은 선택지가 5개(전체·물·불·흙·바람)
 * 라 40×5 = 200px 이 여백만으로 나가고, 320px 화면의 시트 내부 폭(약 256px)을 **글자 없이도
 * 거의 채운다.** 실제로 놓으면 가로로 삐져나온다 — FC-058 이 `grid-cols-2` 기본값으로 겪은
 * 파손과 **같은 종류**(고정 치수를 좁은 폭에서 검증하지 않음)다.
 *
 * 그래서 `flex-wrap` 하는 칩 묶음을 만들되 **면·글자색은 전부 템플릿 gray 토큰**이고
 * 새 팔레트를 들이지 않는다(활성 칩은 `HomeSection` 의 아이콘 배지와 같은 조합).
 *
 * ★ **네이티브 `radio` 위에 얹었다.** `<button>` 묶음으로 만들면 (a) 브라우저가 그룹으로
 *   인식하지 않아 화살표 키 이동이 없고 (b) "무엇이 선택됐는지"를 `aria-*` 로 손수
 *   흉내내야 한다. 라디오는 그 둘이 공짜고, `fieldset`/`legend` 가 그룹 이름까지 읽어준다.
 *   시각적으로만 알약이고 **의미는 라디오 그대로**다.
 */

export interface FilterChipOption {
    /** `null` = 이 축을 걸지 않음("전체") */
    value: number | string | null
    label: string
}

interface FilterChipGroupProps {
    /** 그룹 이름. **`kind` 는 여기에 대분류를 실어 다의성을 없앤다**(예: "무기 종류") */
    legend: string
    /** 선택지 밑에 붙는 설명. 종속 관계·기본값의 의미를 적는 자리 */
    hint?: string
    options: readonly FilterChipOption[]
    value: number | string | null
    onChange: (value: number | string | null) => void
    'data-testid'?: string
}

const CHIP_BASE =
    'cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors duration-150'

/*
 * 비활성 칩.
 *
 * ★ **테두리가 `gray-500` 인 것은 취향이 아니라 측정값이다**(WCAG 1.4.11 비텍스트 3:1).
 *   템플릿 관례대로 `gray-200` 을 쓰면 흰 카드 위에서 **1.26** 이라 알약의 경계가 사실상
 *   보이지 않는다 — 칩은 **누를 수 있는 컨트롤**이므로 경계가 곧 "누를 수 있음"의 신호다
 *   (장식 구분선과 달리 1.4.11 대상이다). `gray-500` 은 흰 카드 4.74 · 다크 카드 3.19 ·
 *   페이지 배경 4.35 로 전 배경에서 통과한다.
 */
const CHIP_IDLE =
    'border-gray-500 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'

/** 활성 칩 — 반전. 색이 아니라 **명도 반전**이라 다크모드에서도 같은 논리로 뒤집힌다. */
const CHIP_ACTIVE =
    'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'

const FilterChipGroup = ({
    legend,
    hint,
    options,
    value,
    onChange,
    'data-testid': testId,
}: FilterChipGroupProps) => {
    const name = useId()

    return (
        <fieldset className="min-w-0" data-testid={testId}>
            <legend className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                {legend}
            </legend>
            {hint && (
                <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                    {hint}
                </p>
            )}
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const selected = option.value === value
                    return (
                        <label
                            key={String(option.value)}
                            className={classNames(
                                CHIP_BASE,
                                selected ? CHIP_ACTIVE : CHIP_IDLE,
                                // 키보드 초점은 라디오가 아니라 알약에 보이게 한다.
                                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gray-900 has-[:focus-visible]:ring-offset-2 dark:has-[:focus-visible]:ring-gray-100',
                            )}
                        >
                            <input
                                type="radio"
                                className="sr-only"
                                name={name}
                                value={String(option.value ?? '')}
                                checked={selected}
                                onChange={() => onChange(option.value)}
                            />
                            {option.label}
                        </label>
                    )
                })}
            </div>
        </fieldset>
    )
}

export default FilterChipGroup
