import Button from '@/components/ui/Button'
/*
 * ★★ **배럴(`ui/Checkbox`)이 아니라 파일을 직접 임포트한다 — 번들 실측으로 잡았다.**
 *
 * `ui/Checkbox/index.tsx` 는 `Checkbox.Group = CheckboxGroup` 을 붙이느라 `Group.tsx` 를
 * 함께 끌고 오고, 그 파일이 `lodash/cloneDeep`·`lodash/remove` 를 임포트한다. 우리는
 * 체크박스 **한 개**를 쓰는데 그 대가로 lodash 내부(Hash·MapCache 등) **약 33 kB(raw)**
 * 가 이 화면 청크에 실렸다(실측: 44.13 → 10.99 kB). 메인 청크에는 lodash 가 없어
 * **중복도 아니고 순수 증가**였다.
 *
 * 같은 템플릿 컴포넌트이고 렌더 결과도 동일하다 — 딸려오는 `Group` 만 뺀 것이다.
 * FC-057 이 framer-motion 을 걷어낸 것과 같은 성격의 조치.
 */
import Checkbox from '@/components/ui/Checkbox/Checkbox'
import Input from '@/components/ui/Input'
import { ELEMENT_CODES, elementLabelOf } from '@/features/item/lib/element'
import { SUB_GROUPS, kindsOf } from '@/features/item/lib/itemCode'
import {
    AUCTION_STATUS_OPTIONS,
    normalizeFilters,
} from '@/features/auction/lib/auctionFilters'
import FilterChipGroup from './FilterChipGroup'
import type { AuctionFilterState } from '@/features/auction/lib/auctionFilters'
import type { FilterChipOption } from './FilterChipGroup'

/**
 * 필터 폼 — **데스크톱 레일과 모바일 바텀시트가 같은 이 컴포넌트를 렌더한다** (FC-059).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **레일용·시트용을 따로 만들지 않았다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 두 벌이면 축을 하나 추가할 때 두 곳을 고쳐야 하고, 한 곳을 빠뜨리면 **화면 폭에 따라
 * 거를 수 있는 조건이 달라진다** — 사용자는 그것을 버그로 인식하지 못하고 그냥
 * "모바일에선 안 되네"로 넘긴다. 껍데기(레일/시트)만 다르고 내용은 하나다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **`kind` 종속을 화면으로 푸는 방식 — 대분류를 고르기 전에는 존재하지 않는다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약 §4.1: *"필터 UI 는 `kind` 선택지를 `subGroup` 선택에 **종속**시키고, `subGroup`
 * 미선택 시 `kind` 필터를 비활성화하거나 '전 대분류 합집합'임을 명시해야 한다."*
 *
 * 우리는 **비활성화가 아니라 미출현**을 골랐다. 회색으로 죽어 있는 컨트롤은 "왜 못 누르지"를
 * 남기고, 그 답이 화면에 없다. 대신:
 *   ① 대분류 미선택 → 종류 묶음이 **아예 없고**, 대분류 밑에 *"대분류를 고르면 종류를 고를
 *      수 있습니다"* 한 줄이 **원인과 해법을 동시에** 말한다.
 *   ② 대분류 선택 → 종류 묶음이 나타나고 **`legend` 가 "무기 종류"** 다.
 *      "종류"가 아니라 **"무기 종류"** 인 것이 핵심이다 — 라벨 자체가 다의성을 없앤다.
 *      마법을 고르면 선택지가 2개(일반·특수)로 줄어드는 것도 표에서 자동으로 나온다.
 *   ③ 대분류를 바꾸면 `normalizeFilters` 가 남은 `kind` 를 떨어뜨린다(무기 검 → 마법으로
 *      바꿔도 `kind=3` 이 살아남아 **성립 불가 조합**을 만들지 않는다).
 *
 * ★ **자유문 검색 입력이 없다.** 계약에 `q`/keyword 가 없어 만들면 아무 동작도 하지 않는
 *   컨트롤이 된다(FC-057 이 같은 이유로 헤더 검색을 만들지 않았다).
 * ★ **`mainCategory`·`skill1`·`skill2` 도 없다** — 사유는 `lib/api/auctions.ts` 주석.
 */

interface AuctionFilterPanelProps {
    value: AuctionFilterState
    onChange: (next: AuctionFilterState) => void
    /** 시트 안에서는 하단 액션이 시트 것이라 여기의 초기화 버튼을 숨긴다 */
    showReset?: boolean
    idPrefix: string
}

const AuctionFilterPanel = ({
    value,
    onChange,
    showReset = true,
    idPrefix,
}: AuctionFilterPanelProps) => {
    /** 모든 변경이 정규화를 지난다 — 종속·범위 뒤집힘이 여기서 정리된다. */
    const patch = (next: Partial<AuctionFilterState>) =>
        onChange(normalizeFilters({ ...value, ...next }))

    const subGroupOptions: FilterChipOption[] = [
        { value: null, label: '전체' },
        ...SUB_GROUPS.map((entry) => ({
            value: entry.code,
            label: entry.label,
        })),
    ]

    const elementOptions: FilterChipOption[] = [
        { value: null, label: '전체' },
        ...ELEMENT_CODES.map((entry) => ({
            value: entry.code,
            label: elementLabelOf(entry.code),
        })),
    ]

    const selectedSubGroup = value.subGroup
    const kindOptions: FilterChipOption[] =
        selectedSubGroup === null
            ? []
            : [
                  { value: null, label: '전체' },
                  ...kindsOf(selectedSubGroup).map((entry) => ({
                      value: entry.code,
                      label: entry.label,
                  })),
              ]
    const subGroupLabel =
        SUB_GROUPS.find((entry) => entry.code === selectedSubGroup)?.label ?? ''

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <FilterChipGroup
                legend="대분류"
                data-testid="filter-subGroup"
                options={subGroupOptions}
                value={selectedSubGroup}
                onChange={(next) =>
                    // 대분류가 바뀌면 종류는 의미를 잃는다 — 명시적으로도 지운다.
                    patch({ subGroup: next as number | null, kind: null })
                }
            />

            {/* ★ 종속의 화면 표현: 대분류가 없으면 종류 묶음 대신 안내 한 줄. */}
            {kindOptions.length === 0 ? (
                <p
                    className="-mt-4 text-xs text-gray-600 dark:text-gray-400"
                    data-testid="kind-dependency-hint"
                >
                    대분류를 고르면 종류를 고를 수 있습니다. 같은 종류 번호가
                    대분류마다 다른 것을 가리키기 때문입니다.
                </p>
            ) : (
                <FilterChipGroup
                    // ★ "종류"가 아니라 "무기 종류" — 라벨이 곧 다의성 해소다.
                    legend={`${subGroupLabel} 종류`}
                    data-testid="filter-kind"
                    options={kindOptions}
                    value={value.kind}
                    onChange={(next) => patch({ kind: next as number | null })}
                />
            )}

            <FilterChipGroup
                legend="속성"
                data-testid="filter-element"
                options={elementOptions}
                value={value.element}
                onChange={(next) => patch({ element: next as number | null })}
            />

            <RangeField
                legend="레벨"
                idPrefix={`${idPrefix}-level`}
                testId="filter-level"
                min={value.minLevel}
                max={value.maxLevel}
                minPlaceholder="1"
                maxPlaceholder="9"
                onChange={(minLevel, maxLevel) => patch({ minLevel, maxLevel })}
            />

            <RangeField
                legend="가격"
                idPrefix={`${idPrefix}-price`}
                testId="filter-price"
                min={value.minPrice}
                max={value.maxPrice}
                minPlaceholder="최소"
                maxPlaceholder="최대"
                unit="게임머니"
                onChange={(minPrice, maxPrice) => patch({ minPrice, maxPrice })}
            />

            <div className="min-w-0">
                <Checkbox
                    checked={value.goldforceActive}
                    onChange={(checked) => patch({ goldforceActive: checked })}
                >
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        골드포스 적용된 매물만
                    </span>
                </Checkbox>
            </div>

            <div className="min-w-0">
                <label
                    className="mb-2 block text-sm font-bold text-gray-900 dark:text-gray-100"
                    htmlFor={`${idPrefix}-status`}
                >
                    상태
                </label>
                {/*
                 * ★★ 선택지가 6개라 칩으로 두면 두 줄을 먹는다. 그리고 상태는 "훑어보며
                 *    고르는" 축이 아니라 **대부분 기본값 그대로 두는** 축이라 접힌 채가 맞다.
                 *
                 * ★ 템플릿 `Select`(react-select)를 쓰지 않았다 — 앱 전체에서 아직 한 번도
                 *   쓰이지 않아 번들에 없는데, 필터 하나 때문에 라이브러리를 들이면
                 *   FC-057 이 framer-motion 을 걷어내 얻은 성과와 같은 종류의 손실이 난다.
                 *   `.input` 은 템플릿 CSS 클래스 그대로라 생김새는 템플릿 것이다.
                 */}
                <select
                    id={`${idPrefix}-status`}
                    data-testid="filter-status"
                    className="input input-sm h-9 w-full"
                    value={value.status ?? ''}
                    onChange={(event) =>
                        patch({ status: event.target.value || null })
                    }
                >
                    {AUCTION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {/*
                 * ★★ 기본 목록에 마감된 경매가 섞이지 않는다는 사실을 **적는다.**
                 *    서버 `statusScope()` 가 status 미지정 시 SCHEDULED·ACTIVE 만 노출한다
                 *    (계약 §3.1). 이 한 줄이 없으면 "낙찰된 매물은 왜 하나도 없지"가
                 *    화면 어디에도 답이 없는 질문으로 남는다.
                 */}
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    기본 목록에는 종료된 경매가 포함되지 않습니다. 낙찰·유찰
                    매물은 상태를 직접 골라야 보입니다.
                </p>
            </div>

            {showReset && (
                <Button
                    block
                    size="sm"
                    type="button"
                    data-testid="filter-reset"
                    onClick={() =>
                        // 정렬은 필터가 아니다 — 초기화가 사용자의 정렬 선택을 뺏지 않는다.
                        onChange(normalizeFilters({ sort: value.sort }))
                    }
                >
                    필터 초기화
                </Button>
            )}
        </div>
    )
}

interface RangeFieldProps {
    legend: string
    idPrefix: string
    testId: string
    min: number | null
    max: number | null
    minPlaceholder: string
    maxPlaceholder: string
    unit?: string
    onChange: (min: number | null, max: number | null) => void
}

/**
 * 최소~최대 한 쌍.
 *
 * ★ `type="number"` + `inputMode="numeric"` — 모바일에서 숫자 키패드가 바로 뜬다.
 * ★ **두 입력에 각각 보이지 않는 라벨을 준다.** 스크린리더로는 `fieldset` 이름("레벨")만
 *   들리면 두 칸 중 어느 쪽인지 알 수 없다. 시각적으로는 `~` 기호가 그 일을 한다.
 * ★ 뒤집힌 범위(최소 > 최대)는 `normalizeFilters` 가 맞바꾼다 — 입력 중에 값을 뺏지 않고
 *   상태로 올라갈 때 정리되므로 타이핑이 끊기지 않는다.
 */
const RangeField = ({
    legend,
    idPrefix,
    testId,
    min,
    max,
    minPlaceholder,
    maxPlaceholder,
    unit,
    onChange,
}: RangeFieldProps) => {
    const parse = (raw: string) => (raw === '' ? null : Number(raw))

    return (
        <fieldset className="min-w-0" data-testid={testId}>
            <legend className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                {legend}
                {unit && (
                    <span className="ml-1 font-normal text-gray-600 dark:text-gray-400">
                        ({unit})
                    </span>
                )}
            </legend>
            <div className="flex min-w-0 items-center gap-2">
                <label className="sr-only" htmlFor={`${idPrefix}-min`}>
                    {legend} 최소
                </label>
                <Input
                    id={`${idPrefix}-min`}
                    className="min-w-0"
                    size="sm"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={minPlaceholder}
                    value={min ?? ''}
                    onChange={(event) =>
                        onChange(parse(event.target.value), max)
                    }
                />
                <span
                    aria-hidden="true"
                    className="shrink-0 text-sm text-gray-500 dark:text-gray-400"
                >
                    ~
                </span>
                <label className="sr-only" htmlFor={`${idPrefix}-max`}>
                    {legend} 최대
                </label>
                <Input
                    id={`${idPrefix}-max`}
                    className="min-w-0"
                    size="sm"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={maxPlaceholder}
                    value={max ?? ''}
                    onChange={(event) =>
                        onChange(min, parse(event.target.value))
                    }
                />
            </div>
        </fieldset>
    )
}

export default AuctionFilterPanel
