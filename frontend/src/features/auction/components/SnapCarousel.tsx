import { useCallback, useEffect, useRef, useState } from 'react'
import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import classNames from '@/utils/classNames'
import type { ReactNode } from 'react'

/**
 * 스크롤 스냅 캐러셀 (FC-058 재작업 — 피드백 5 "슬라이드 처리").
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **라이브러리를 추가하지 않았다. CSS `scroll-snap` 하나로 된다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 템플릿에 캐러셀이 없다(`ui/Slider` 는 range input 이고 데모에 캐러셀 사용례가 0건).
 * 그렇다고 embla/swiper 를 들이면 **FC-057 이 framer-motion 을 걷어내 만든 592→472KB 를
 * 그대로 반납**한다(embla ~20KB, swiper ~100KB+). 이 화면이 필요한 것은
 * "가로로 넘겨 본다"뿐이고, 그건 브라우저가 이미 할 줄 안다:
 *
 * | 요구 | 네이티브 해법 |
 * |---|---|
 * | 스와이프(모바일) | 그냥 스크롤 — **관성·고무줄까지 OS 가 준다**(JS 흉내보다 낫다) |
 * | 한 칸씩 멈춤 | `scroll-snap-type: x mandatory` + 자식 `snap-start` |
 * | 이전/다음 | `scrollBy()` |
 * | 키보드 | 슬라이드 안의 링크가 이미 탭 대상이고, 포커스가 들어가면 **브라우저가
 *            알아서 스크롤**한다. 별도 키 핸들러가 필요 없다 |
 * | 접근성 | 마크업(`aria-roledescription`·라이브 위치 안내) |
 *
 * ★ **JS 없이도 동작한다** — 위치 표시와 버튼만 JS 를 쓰고, 스크롤 자체는 CSS 다.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **"몇 장 보이나"를 이 컴포넌트가 몰라도 된다 — 페이지 단위로 움직인다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 슬라이드 폭은 **CSS 가 브레이크포인트마다 정한다**(모바일 1장 · 태블릿 2장 · 데스크톱 3장).
 * 여기서는 `clientWidth`(= 한 화면분) 만큼 스크롤하고, 페이지 수도
 * `scrollWidth / clientWidth` 로 낸다. 그래서 **JS 가 브레이크포인트를 복제하지 않는다** —
 * 반응형 규칙이 CSS 한 곳에만 있고, 열 수를 바꿔도 이 파일은 손댈 필요가 없다.
 *
 * ★ 위치는 `scrollLeft` 기반이라 **손가락으로 넘겨도 인디케이터가 따라온다.**
 *   버튼 클릭만 세면 스와이프와 표시가 어긋난다.
 */

interface SnapCarouselProps {
    /** 슬라이드. 폭은 CSS 가 정한다 */
    children: ReactNode[]
    /** 스크린리더가 읽을 캐러셀 이름 */
    label: string
    className?: string
}

const SnapCarousel = ({ children, label, className }: SnapCarouselProps) => {
    const trackRef = useRef<HTMLUListElement>(null)
    const [{ page, pageCount }, setPosition] = useState({
        page: 0,
        pageCount: 1,
    })

    const measure = useCallback(() => {
        const track = trackRef.current
        if (!track) return

        const view = track.clientWidth
        if (view === 0) return // 아직 레이아웃 전(또는 숨겨진 상태)

        setPosition({
            page: Math.round(track.scrollLeft / view),
            // 부동소수 오차로 페이지가 하나 더 생기지 않게 1px 여유를 둔다.
            pageCount: Math.max(1, Math.ceil((track.scrollWidth - 1) / view)),
        })
    }, [])

    useEffect(() => {
        const track = trackRef.current
        if (!track) return

        measure()
        track.addEventListener('scroll', measure, { passive: true })
        window.addEventListener('resize', measure)
        return () => {
            track.removeEventListener('scroll', measure)
            window.removeEventListener('resize', measure)
        }
    }, [measure, children.length])

    const scrollByPage = (direction: -1 | 1) => {
        const track = trackRef.current
        if (!track) return
        track.scrollBy({ left: direction * track.clientWidth })
        // jsdom·구형 브라우저가 scroll 이벤트를 안 낼 수 있어 낙관적으로 먼저 맞춘다.
        setPosition((prev) => ({
            ...prev,
            page: Math.min(
                Math.max(prev.page + direction, 0),
                prev.pageCount - 1,
            ),
        }))
    }

    if (children.length === 0) return null

    const hasPages = pageCount > 1

    return (
        <div
            aria-label={label}
            aria-roledescription="carousel"
            className={classNames('flex flex-col gap-3', className)}
            data-testid="snap-carousel"
            role="group"
        >
            <ul
                ref={trackRef}
                className={classNames(
                    'flex snap-x snap-mandatory overflow-x-auto',
                    'gap-4 pb-1',
                    'motion-safe:scroll-smooth',
                )}
                data-testid="carousel-track"
            >
                {children.map((slide, slideIndex) => (
                    <li
                        // 슬라이드는 순서가 곧 정체성이고 재정렬되지 않는다(마감 순 고정).
                        key={slideIndex}
                        aria-label={`${slideIndex + 1} / ${children.length}`}
                        aria-roledescription="slide"
                        /*
                         * ★ 반응형 규칙이 사는 유일한 곳. gap-4(16px)를 뺀 뒤 나눈다.
                         *   모바일 1장 → 태블릿 2장 → 데스크톱 3장.
                         */
                        className="w-full shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
                    >
                        {slide}
                    </li>
                ))}
            </ul>

            {/* 페이지가 하나면 컨트롤을 만들지 않는다 — 누를 수 없는 버튼은 거짓말이다. */}
            {hasPages && (
                <div className="flex items-center justify-end gap-3">
                    <span
                        aria-live="polite"
                        className="text-xs font-bold tabular-nums text-gray-600 dark:text-gray-400"
                        data-testid="carousel-position"
                    >
                        {page + 1} / {pageCount}
                    </span>

                    <div className="flex items-center gap-2">
                        {/*
                         * ★★ **`aria-disabled` 를 함께 준다 — 템플릿 `Button` 이 `disabled` 를
                         *    DOM 에 흘리지 않기 때문이다.** `ui/Button` 은 prop 을 구조분해로
                         *    꺼내 `opacity-50 cursor-not-allowed` **클래스만** 붙이고 내부에서
                         *    onClick 을 막는다. 즉 **눈에만 비활성이고 보조기술에는 멀쩡한
                         *    버튼**으로 보인다 — 스크린리더 사용자는 누를 수 있다고 판단하고
                         *    눌렀는데 아무 일도 안 일어난다. `{...rest}` 로 통과하는
                         *    `aria-disabled` 가 그 구멍을 메운다(템플릿 무수정).
                         */}
                        <Button
                            aria-disabled={page === 0}
                            aria-label="이전 매물"
                            disabled={page === 0}
                            icon={<PiCaretLeftBold />}
                            shape="circle"
                            size="xs"
                            onClick={() => scrollByPage(-1)}
                        />
                        <Button
                            aria-disabled={page >= pageCount - 1}
                            aria-label="다음 매물"
                            disabled={page >= pageCount - 1}
                            icon={<PiCaretRightBold />}
                            shape="circle"
                            size="xs"
                            onClick={() => scrollByPage(1)}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default SnapCarousel
