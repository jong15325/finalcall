import { useCallback, useEffect, useRef, useState } from 'react'
import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import classNames from '@/utils/classNames'
import './snapCarousel.css'
import type { ReactNode } from 'react'

/**
 * 스크롤 스냅 캐러셀 (FC-058 — 재설계 3차: 스와이프 감각·peek·진행 표시).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **라이브러리 0. CSS `scroll-snap` 이 스와이프의 본체다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * embla(~20KB)·swiper(~100KB+)를 들이면 FC-057 이 framer-motion 을 걷어내 만든
 * 592→472KB 를 반납한다. 그리고 **네이티브가 더 낫다** — 관성·고무줄·감속 곡선은 OS 가
 * 손가락 속도까지 반영해 계산하는데, JS 캐러셀은 그걸 근사할 뿐이다.
 *
 * ── 3차 재설계에서 고친 것 ────────────────────────────────────────────────────
 * **(1) peek — "더 있다"를 정적으로 알린다.**
 *   종전 슬라이드는 폭이 정확히 100%(또는 1/2·1/3)라 **다음 카드가 한 픽셀도 안 보였다.**
 *   화살표를 누르기 전엔 넘길 게 있는지 알 수 없고, 모바일에선 화살표가 아래에 있어
 *   더 그렇다. 이제 base 에서 `100% - 1.5rem` 을 써 **24px 이 다음 카드로 남는다.**
 *   잘린 카드가 보이는 것 자체가 "옆으로 밀어라"는 가장 직접적인 신호다.
 *
 * **(2) 페이지 이동을 "화면 폭"이 아니라 "슬라이드 피치"로 계산한다.**
 *   peek 이 생기면 `clientWidth` 만큼 스크롤할 때 **매번 조금씩 어긋나** 누적되면 카드가
 *   반쯤 걸친 채 멈춘다. 피치(= 다음 슬라이드 시작점 − 현재 시작점)는 **gap 까지 포함한
 *   실측값**이라 어긋나지 않는다. `offsetLeft` 차이로 재므로 CSS 를 바꿔도 JS 는 그대로다.
 *
 * **(3) 경계 처리 — `overscroll-behavior-x: contain`.**
 *   없으면 끝에서 더 밀 때 **브라우저 뒤로가기 제스처**나 페이지 가로 스크롤로 새어 나간다.
 *   모바일에서 캐러셀을 넘기다 화면이 통째로 뒤로 가는 사고가 여기서 난다.
 *
 * **(4) 진행 표시 — 막대 + 숫자.**
 *   점(dot)은 페이지가 늘면 무너진다. 막대는 몇 페이지든 같은 폭이라 확장에 강하고,
 *   스와이프 중에도 `scrollLeft` 를 그대로 반영해 **손가락과 함께 움직인다.**
 *
 * **(5) 화살표는 `sm` 이상에서만.**
 *   모바일의 주 조작은 스와이프이고, 작은 화면에서 화살표는 자리만 먹는다. 대신 peek 과
 *   막대가 상태를 알린다. 데스크톱은 반대로 스와이프가 없으니 화살표가 주 조작이다.
 *
 * ── 접근성 ────────────────────────────────────────────────────────────────────
 * ★ 키보드: 슬라이드 안의 링크가 이미 탭 대상이고 포커스가 들어가면 브라우저가 스크롤한다.
 *   별도 키 핸들러를 만들지 않는다(만들면 네이티브 동작과 충돌한다).
 * ★ `aria-disabled` 를 함께 준다 — 템플릿 `ui/Button` 이 `disabled` 를 **DOM 에 흘리지 않고**
 *   클래스만 바꾸기 때문이다(눈에만 비활성, 보조기술엔 멀쩡한 버튼). 템플릿 무수정 우회.
 * ★ 감소 모드에서 `scroll-behavior: smooth` 가 빠진다 — 이동은 남고 트윈만 사라진다.
 */

interface SnapCarouselProps {
    /** 슬라이드. 폭은 CSS 가 정한다 */
    children: ReactNode[]
    /** 스크린리더가 읽을 캐러셀 이름 */
    label: string
    className?: string
}

interface Position {
    page: number
    pageCount: number
    /** 0~1. 진행 막대가 쓴다 — 페이지 단위가 아니라 **연속값**이라 스와이프 중에도 흐른다 */
    progress: number
}

const SnapCarousel = ({ children, label, className }: SnapCarouselProps) => {
    const trackRef = useRef<HTMLUListElement>(null)
    const [{ page, pageCount, progress }, setPosition] = useState<Position>({
        page: 0,
        pageCount: 1,
        progress: 0,
    })

    /** 슬라이드 피치(폭 + gap). 두 슬라이드의 `offsetLeft` 차이라 gap 을 따로 알 필요가 없다. */
    const pitchOf = (track: HTMLElement): number => {
        const slides = track.children
        if (slides.length >= 2) {
            const first = slides[0] as HTMLElement
            const second = slides[1] as HTMLElement
            const pitch = second.offsetLeft - first.offsetLeft
            if (pitch > 0) return pitch
        }
        return (slides[0] as HTMLElement | undefined)?.offsetWidth ?? 0
    }

    const measure = useCallback(() => {
        const track = trackRef.current
        if (!track) return

        const view = track.clientWidth
        const pitch = pitchOf(track)
        // 아직 레이아웃 전(또는 숨겨진 상태) — 0으로 나누지 않는다.
        if (view === 0 || pitch === 0) return

        const perView = Math.max(1, Math.round(view / pitch))
        const step = perView * pitch
        const scrollable = track.scrollWidth - view

        setPosition({
            page: Math.round(track.scrollLeft / step),
            pageCount: Math.max(1, Math.ceil(children.length / perView)),
            progress: scrollable > 0 ? track.scrollLeft / scrollable : 0,
        })
    }, [children.length])

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
    }, [measure])

    const scrollByPage = (direction: -1 | 1) => {
        const track = trackRef.current
        if (!track) return

        const pitch = pitchOf(track)
        const perView = Math.max(1, Math.round(track.clientWidth / pitch || 1))
        track.scrollBy({ left: direction * perView * pitch })
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
                    'fc-carousel-track flex snap-x snap-mandatory overflow-x-auto',
                    'gap-4',
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
                         * ★ 반응형 규칙이 사는 유일한 곳.
                         *   base: 1장 + 24px peek · lg: 2장 · xl: 3장.
                         *   **`sm` 에서 2장으로 쪼개지 않는다** — 640px 에서 2분할하면 카드
                         *   내부 폭이 320px 때와 같아져 정보열이 다시 무너진다(실측).
                         */
                        className="w-[calc(100%-1.5rem)] shrink-0 snap-start lg:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]"
                    >
                        {slide}
                    </li>
                ))}
            </ul>

            {/* 넘길 것이 없으면 컨트롤을 만들지 않는다 — 누를 수 없는 버튼은 거짓말이다. */}
            {hasPages && (
                <div className="flex items-center gap-3">
                    {/*
                     * 진행 막대. `aria-hidden` — 같은 정보를 옆 숫자가 글자로 말하므로
                     * 스크린리더가 두 번 듣지 않게 한다.
                     */}
                    <div
                        aria-hidden="true"
                        className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
                    >
                        <div
                            className="h-full rounded-full bg-gray-900 motion-safe:transition-[width,margin] motion-safe:duration-200 motion-safe:ease-out dark:bg-gray-100"
                            data-testid="carousel-progress"
                            style={{
                                width: `${100 / pageCount}%`,
                                marginInlineStart: `${progress * (100 - 100 / pageCount)}%`,
                            }}
                        />
                    </div>

                    <span
                        aria-live="polite"
                        className="shrink-0 text-xs font-bold tabular-nums text-gray-600 dark:text-gray-400"
                        data-testid="carousel-position"
                    >
                        {page + 1} / {pageCount}
                    </span>

                    {/* 모바일은 스와이프가 주 조작이라 화살표를 두지 않는다. */}
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
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
