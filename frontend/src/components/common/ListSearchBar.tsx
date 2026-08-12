import { useEffect, useId, useRef, useState } from 'react'
import { TbSearch, TbX } from 'react-icons/tb'

/**
 * 목록 내 자유문 검색 입력 (FC-108 — 계약 §3 `q` · search-spec v0.3 §12.7 C1~C3).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **URL searchParams 가 정본이다.** 이 컴포넌트는 로컬 입력 상태만 들고, 디바운스 후
 *    `onChange` 로 상위(페이지)에 커밋한다 — 커밋값이 URL 에 반영되면 `value` 로 되돌아온다.
 * ══════════════════════════════════════════════════════════════════════════════
 *  - **상단 전역 검색이 아니라 페이지 내 목록 검색이다**(mockup §5.2 · rebuild-contract-map —
 *    전역 검색 신설 금지). 기존 필터·정렬과 병존한다.
 *  - **계약 C3 클라 힌트**: 최소 2자·최대 64자. **1자는 커밋하지 않고 힌트만 보인다**
 *    (서버가 400 을 낼 조합을 UI 가 만들지 않는다). 최대 64 는 `maxLength` 로 하드캡한다.
 *  - **디바운스**: 마지막 입력 뒤 `DEBOUNCE_MS` 후 한 번만 커밋한다 — 매 타건 요청을 막는다.
 *
 * ★ `onChange('')`(빈 문자열) = 검색 해제. 그 밖은 항상 2~64자.
 */

const DEBOUNCE_MS = 300
const MIN_LENGTH = 2
const MAX_LENGTH = 64

interface ListSearchBarProps {
    /** 커밋된 검색어(= URL 정본). 없으면 빈 문자열 */
    value: string
    /** 디바운스 후 커밋 — 빈 문자열이면 검색 해제, 그 외엔 2~64자 */
    onChange: (q: string) => void
    /** 입력 접근성 라벨(화면엔 시각적 라벨 없이 아이콘+placeholder) */
    label: string
    placeholder: string
}

function ListSearchBar({
    value,
    onChange,
    label,
    placeholder,
}: ListSearchBarProps) {
    const hintId = useId()
    const [text, setText] = useState(value)

    // 외부 변경(초기화·뒤로가기·링크 진입)을 로컬 입력에 반영한다.
    useEffect(() => {
        setText(value)
    }, [value])

    // ★ onChange 를 ref 로 고정해 디바운스가 상위 콜백 재생성에 흔들리지 않게 한다
    //   (deps 에 onChange 를 넣으면 매 렌더 타이머가 리셋돼 디바운스가 깨진다).
    const onChangeRef = useRef(onChange)
    useEffect(() => {
        onChangeRef.current = onChange
    })

    const trimmed = text.trim()
    const belowMin = trimmed.length === 1

    useEffect(() => {
        const next = text.trim()
        if (next === value) return
        // 1자는 커밋하지 않는다(계약 C3 최소 2자) — 힌트만 보이고 이전 검색을 유지한다.
        if (next.length === 1) return
        const timer = setTimeout(() => {
            onChangeRef.current(next.length >= MIN_LENGTH ? next : '')
        }, DEBOUNCE_MS)
        return () => clearTimeout(timer)
    }, [text, value])

    return (
        <div className="mb-3">
            <div className="flex items-center gap-2 rounded-lg border border-content-line bg-content-soft px-3 py-2 focus-within:border-control-action focus-within:ring-2 focus-within:ring-control-action/30">
                <TbSearch
                    aria-hidden
                    className="size-4 shrink-0 text-content-subtle"
                />
                <input
                    type="search"
                    aria-label={label}
                    aria-describedby={belowMin ? hintId : undefined}
                    maxLength={MAX_LENGTH}
                    value={text}
                    placeholder={placeholder}
                    className="w-full min-w-0 flex-1 bg-transparent text-sm text-content-fg outline-none placeholder:text-content-subtle [&::-webkit-search-cancel-button]:appearance-none"
                    onChange={(event) => setText(event.target.value)}
                />
                {text && (
                    <button
                        type="button"
                        aria-label="검색어 지우기"
                        className="shrink-0 rounded-full p-0.5 text-content-subtle hover:text-content-fg"
                        onClick={() => {
                            setText('')
                            onChangeRef.current('')
                        }}
                    >
                        <TbX aria-hidden className="size-4" />
                    </button>
                )}
            </div>
            {belowMin && (
                <p
                    id={hintId}
                    role="status"
                    className="mt-1 px-1 text-[11px] text-content-subtle"
                >
                    검색어는 2자 이상 입력하세요.
                </p>
            )}
        </div>
    )
}

export default ListSearchBar
