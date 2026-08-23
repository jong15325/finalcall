import { Link, useLocation } from 'react-router'
import { TbColumns3, TbX } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { MAX_COMPARE_ITEMS } from '@/store/compareSession'
import { useCompareStore } from '@/store/compareStore'

/**
 * 플로팅 비교 바 (FC-079 — 목업 `renderCompareTray` 1:1, 색만 브랜드 §2.9).
 *
 * ★ **선택이 있을 때만, 비교 페이지 밖에서만** 뜬다(목업: compare·login·signup 에서 숨김).
 *   login/signup 은 `AppShell` 밖(AuthLayout)이라 애초에 마운트되지 않고, 여기선 compare 만 가린다.
 * ★ **모바일 하단 네비 위에 뜬다**(겹침 금지, §5.3) — 하단 오프셋을 네비 높이+safe-area 만큼 준다.
 *   PC 는 우하단. z-index 는 모바일 네비(z-30)보다 위(z-40).
 * ★ 비교표는 2개 이상이라야 의미가 있다 → **"비교하기" 는 2개 미만이면 `disabled`**
 *   (`aria-disabled`+포인터 차단, 클래스만 X). 슬롯 타일은 최대 3칸(채움 + 점선 빈칸).
 * ★ **스토어가 유일 진실** — 카드에서 담고 여기서 빼도 같은 스토어를 구독하는 카드/페이지가
 *   즉시 동기화된다. 참조만 갖고 아트를 안 받으므로(전역 상시 마운트 컴포넌트의 과호출 방지)
 *   타일은 이미지 대신 순번으로 표기한다 — 상세 대조는 비교 페이지에서 한다.
 */
function CompareBar() {
    const location = useLocation()
    const items = useCompareStore((state) => state.items)
    const remove = useCompareStore((state) => state.remove)
    const clear = useCompareStore((state) => state.clear)

    // 비교 페이지에서는 숨긴다(표 자체가 화면이라 바가 중복이다).
    if (location.pathname === paths.compare) return null
    if (items.length === 0) return null

    const canCompare = items.length >= 2
    const emptySlots = Math.max(0, MAX_COMPARE_ITEMS - items.length)

    return (
        <aside
            aria-label="아이템 비교 선택"
            aria-live="polite"
            className="compare-bar liquid-frost liquid-frost--strong fixed z-40 flex items-center gap-2 rounded-xl px-3 py-3 sm:gap-3 sm:px-4"
        >
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-chrome-raised text-brand-highlight-bright">
                    <TbColumns3 aria-hidden className="size-5" />
                </span>
                <span className="grid min-w-0">
                    <strong className="text-[13px] text-chrome-fg">
                        아이템 비교{' '}
                        <b className="text-control-action">
                            {items.length}/{MAX_COMPARE_ITEMS}
                        </b>
                    </strong>
                    <small className="truncate text-[11px] text-chrome-muted">
                        {canCompare
                            ? '가격과 스킬 1·2를 우선 비교합니다'
                            : '한 개 더 담으면 비교할 수 있어요'}
                    </small>
                </span>
            </span>

            {/* 선택 슬롯 — 채움(순번 + 빼기) + 점선 빈칸. 모바일에선 공간상 숨긴다(목업 §233). */}
            <span className="hidden items-center gap-1.5 sm:flex">
                {items.map((item, index) => (
                    <span
                        key={item.listingId}
                        className="relative grid size-11 place-items-center rounded-lg border border-chrome-selected bg-chrome-raised text-xs font-bold text-chrome-fg"
                    >
                        {index + 1}
                        <button
                            type="button"
                            aria-label={`${index + 1}번 아이템 비교에서 빼기`}
                            className="absolute -right-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full bg-control-action text-control-action-ink hover:bg-control-action-hover"
                            onClick={() => remove(item.listingId)}
                        >
                            <TbX aria-hidden className="size-3" />
                        </button>
                    </span>
                ))}
                {Array.from({ length: emptySlots }).map((_, index) => (
                    <span
                        key={`empty-${index}`}
                        aria-hidden
                        className="grid size-11 place-items-center rounded-lg border border-dashed border-chrome-selected text-chrome-muted"
                    >
                        +
                    </span>
                ))}
            </span>

            <span className="flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    className="hidden rounded-lg border border-chrome-selected px-3 py-2 text-xs font-bold text-chrome-muted hover:bg-chrome-raised hover:text-chrome-fg sm:block"
                    onClick={clear}
                >
                    전체 해제
                </button>
                {canCompare ? (
                    <Link
                        to={paths.compare}
                        className="whitespace-nowrap rounded-lg bg-control-action px-4 py-2 text-xs font-bold text-control-action-ink hover:bg-control-action-hover"
                    >
                        비교하기
                    </Link>
                ) : (
                    <span
                        aria-disabled="true"
                        className="cursor-not-allowed whitespace-nowrap rounded-lg bg-chrome-raised px-4 py-2 text-xs font-bold text-chrome-muted opacity-60"
                    >
                        비교하기
                    </span>
                )}
            </span>
        </aside>
    )
}

export default CompareBar
