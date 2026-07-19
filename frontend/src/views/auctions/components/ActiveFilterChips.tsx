import { PiXBold } from 'react-icons/pi'
import { activeFilterChipsOf } from '@/features/auction/lib/auctionFilters'
import type { AuctionFilterState } from '@/features/auction/lib/auctionFilters'

/**
 * 적용된 필터 칩 줄 (FC-059).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **모바일에서 이 줄이 유일하게 "지금 무엇이 걸려 있는가"를 말한다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 데스크톱은 레일이 늘 보이므로 선택 상태가 화면에 있다. 시트는 닫히면 사라진다 —
 * 칩 줄이 없으면 결과가 적을 때 **거른 것 때문인지 매물이 없는 것인지 구분할 수 없다.**
 * 그래서 데스크톱에서도 같이 보인다(같은 정보를 두 곳에서 확인할 수 있는 것은 손해가 아니다).
 *
 * ★ **칩 하나 = 축 하나의 해제 버튼.** 되돌리려고 시트를 다시 열 필요가 없다.
 * ★ `kind` 칩은 **"무기 · 검"** 처럼 대분류를 함께 적는다 — `auctionFilters` 주석의 이유.
 */

interface ActiveFilterChipsProps {
    value: AuctionFilterState
    onChange: (next: AuctionFilterState) => void
    onReset: () => void
}

const ActiveFilterChips = ({
    value,
    onChange,
    onReset,
}: ActiveFilterChipsProps) => {
    const chips = activeFilterChipsOf(value)

    if (chips.length === 0) return null

    return (
        <div
            aria-label="적용된 필터"
            className="flex flex-wrap items-center gap-2"
            data-testid="active-filter-chips"
            role="group"
        >
            {chips.map((chip) => (
                <button
                    key={chip.id}
                    /*
                     * ★ 테두리 `gray-500` — 측정값이다. 이 칩은 **페이지 배경(gray-100) 위에
                     *   흰 면**이라 면끼리의 대비가 1.06 이고, 경계선이 유일한 윤곽이다.
                     *   템플릿 관례인 `gray-300` 은 1.36 이라 알약이 배경에 녹아 "누를 수
                     *   있는 것"으로 보이지 않는다(WCAG 1.4.11 비텍스트 3:1).
                     *   `gray-500` = 라이트 4.35 · 다크 4.18.
                     */
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-500 bg-white px-3 py-1 text-sm font-semibold text-gray-800 transition-colors duration-150 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                    data-testid={`active-chip-${chip.id}`}
                    type="button"
                    onClick={() => onChange({ ...value, ...chip.patch })}
                >
                    <span className="truncate">{chip.label}</span>
                    {/* 아이콘은 장식이라 숨기고, 무엇을 하는 버튼인지는 글자로 준다. */}
                    <PiXBold aria-hidden="true" className="shrink-0 text-xs" />
                    <span className="sr-only">필터 해제</span>
                </button>
            ))}

            {/* 칩이 여럿일 때만 나온다 — 하나뿐이면 그 칩이 곧 전체 해제다. */}
            {chips.length > 1 && (
                <button
                    className="rounded-full px-2 py-1 text-sm font-semibold text-gray-600 underline underline-offset-2 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    data-testid="clear-all-filters"
                    type="button"
                    onClick={onReset}
                >
                    전체 해제
                </button>
            )}
        </div>
    )
}

export default ActiveFilterChips
