import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { itemArt } from '@/features/item/lib/itemArt'
import type { ItemArtInput } from '@/features/item/lib/itemArt'
import './HomeBanner.css'

/**
 * 홈 배너 캐러셀 — 목업 `#home` `home-carousel`(3슬라이드) 이식. Swiper 등 **의존성 없이**
 * 최소 React/CSS(`translateX` 트랙 + `setInterval`)로 자동넘김·인디케이터·prev/next 를 구현한다.
 *
 * ★ **슬라이드 내용은 목업 `market.js home()` 1:1**: WEEKLY BENEFIT / REALTIME AUCTION /
 *   PRICE INSIGHT(준비 중). CTA 대상도 목업대로(`#market`·`#auction`) — 라우트로 매핑한다.
 *   `/market` 은 고정가 마켓 준비 중 안내 셸이라 404 가 아니다(데드링크 아님, §5).
 * ★ **slide-art = 공용 art**(`itemArt`) — 목업처럼 슬라이드마다 아이템 아트 2개를 장식으로 띄운다.
 *   장식이므로 `aria-hidden`, 정수배 + `pixelated`(비정수 확대는 픽셀아트를 뭉갠다).
 * ★ **접근성**: 비활성 슬라이드는 `aria-hidden` + 링크 `tabIndex=-1`(화면 밖 초점 유출 차단).
 *   자동넘김은 `prefers-reduced-motion`·hover/focus 중 정지(WCAG 2.2.2). 도트는 `<button>`+`aria-current`.
 * ★ **스와이프**: 포인터 이벤트만으로 터치·마우스 드래그를 처리(무의존, FC-069 유지). 세로 스크롤은
 *   `touch-action: pan-y` 로 살리고, 가로 드래그가 임계값을 넘으면 슬라이드를 넘긴다. 드래그로 넘긴
 *   직후의 링크 클릭은 캡처 단계에서 취소해 의도치 않은 이동을 막는다.
 * ★ **색은 브랜드 토큰**(navy/gold/orange, §2.9) — 목업의 Vuexy `bg-label-*` 블루/그레이를 복제하지
 *   않고 브랜드 그라데이션·배지로 치환한다. 구조·문구·치수는 목업을 따른다.
 */

interface BannerSlide {
    id: string
    /** 목업 배지(예: WEEKLY BENEFIT) */
    tag: string
    /** 목업 보조 배지(준비 중 등) — 없으면 미표시 */
    subTag?: string
    title: string
    description: string
    cta: string
    href: string
    /** 브랜드 그라데이션(배경) — Vuexy 블루 복제 금지(§2.9) */
    surface: string
    /** 장식용 아이템 아트 2개(공용 art 축) */
    art: ItemArtInput[]
}

/** 장식 아트 축(레전드 장비 톤 — level 9). 데이터가 아니라 배너 장식이다. */
const SLIDES: BannerSlide[] = [
    {
        id: 'benefit',
        tag: 'WEEKLY BENEFIT',
        title: '거래 수수료 30% 할인',
        description:
            '이번 주말, 레전드 장비 거래 수수료를 더 가볍게 만나보세요.',
        cta: '할인 아이템 보기',
        href: paths.market,
        surface: 'from-chrome-strong via-chrome-raised to-brand-highlight-deep',
        art: [
            { subGroup: 1, kind: 3, element: 2, level: 9 },
            { subGroup: 1, kind: 1, element: 3, level: 9 },
        ],
    },
    {
        id: 'auction',
        tag: 'REALTIME AUCTION',
        title: '마감 임박 경매를 확인하세요',
        description:
            '단 20분 남은 레전드 장비. 지금 입찰에 참여할 수 있습니다.',
        cta: '경매 참여하기',
        href: paths.auctions,
        surface:
            'from-chrome-strong via-chrome-selected to-control-action-hover',
        art: [
            { subGroup: 1, kind: 4, element: 4, level: 9 },
            { subGroup: 1, kind: 2, element: 1, level: 9 },
        ],
    },
    {
        id: 'insight',
        tag: 'PRICE INSIGHT',
        subTag: '준비 중',
        title: 'AI 시세 분석, 더 똑똑한 거래',
        description: '최근 체결가와 수요를 분석해 적정 거래 가격을 제안합니다.',
        cta: '시세 확인하기',
        href: paths.market,
        surface: 'from-chrome-raised via-chrome-selected to-brand-structure',
        art: [
            { subGroup: 2, kind: 3, element: 2, level: 9 },
            { subGroup: 2, kind: 1, element: 1, level: 9 },
        ],
    },
]

const AUTO_ADVANCE_MS = 5000

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

/** 슬라이드 장식 아트 — 장식이므로 a11y 트리에서 제외(`aria-hidden`). */
function SlideArt({ art }: { art: ItemArtInput[] }) {
    return (
        <span
            aria-hidden="true"
            className="home-banner__art pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0 sm:right-8"
        >
            {art.map((input, index) => {
                const resolved = itemArt(input, 'l', 2)
                if (!resolved) return null
                return (
                    <img
                        key={index}
                        src={resolved.src}
                        alt=""
                        width={resolved.width}
                        height={resolved.height}
                        className={`drop-shadow-[var(--shadow-art)] [image-rendering:pixelated] ${
                            index === 0
                                ? 'translate-y-1'
                                : '-translate-y-2 opacity-90'
                        }`}
                    />
                )
            })}
        </span>
    )
}

/** 드래그로 슬라이드를 넘길 최소 가로 이동(px). 이보다 작으면 클릭으로 본다. */
const SWIPE_THRESHOLD = 45

/** 연결용 첫 슬라이드에서 실제 첫 슬라이드로 시각 변화 없이 순간 이동한다. */
function resetLoopPosition(track: HTMLDivElement) {
    const previousBehavior = track.style.scrollBehavior
    track.style.scrollBehavior = 'auto'
    track.scrollTo({ left: 0, behavior: 'auto' })
    requestAnimationFrame(() => {
        track.style.scrollBehavior = previousBehavior
    })
}

function HomeBanner() {
    const [active, setActive] = useState(0)
    const [paused, setPaused] = useState(false)
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 640,
    )
    const count = SLIDES.length
    const trackRef = useRef<HTMLDivElement>(null)
    const loopResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const loopResetPendingRef = useRef(false)
    const renderedSlides = isMobile ? [...SLIDES, SLIDES[0]] : SLIDES

    const go = useCallback(
        (index: number) => {
            const next = (index + count) % count
            const trackIndex = isMobile && index >= count ? count : next
            setActive(next)
            if (isMobile) {
                requestAnimationFrame(() => {
                    const track = trackRef.current
                    if (!track) return
                    track.scrollTo({
                        left: trackIndex * (track.clientWidth + 12),
                        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
                    })
                })
            }
        },
        [count, isMobile],
    )

    useEffect(() => {
        const updateMode = () => setIsMobile(window.innerWidth < 640)
        window.addEventListener('resize', updateMode)
        return () => window.removeEventListener('resize', updateMode)
    }, [])

    useEffect(() => {
        if (isMobile) return
        const track = trackRef.current
        if (!track) return
        track.scrollLeft = 0
    }, [isMobile])

    useEffect(
        () => () => {
            if (loopResetRef.current) clearTimeout(loopResetRef.current)
        },
        [],
    )

    useEffect(() => {
        const track = trackRef.current
        if (!track || !isMobile) return
        const finishLoop = () => {
            if (!loopResetPendingRef.current) return
            loopResetPendingRef.current = false
            if (loopResetRef.current) {
                clearTimeout(loopResetRef.current)
                loopResetRef.current = null
            }
            resetLoopPosition(track)
        }
        track.addEventListener('scrollend', finishLoop)
        return () => track.removeEventListener('scrollend', finishLoop)
    }, [isMobile])

    // 포인터 드래그 상태(리렌더 없이 추적) — startX·최대 이동·"넘김 발생" 플래그.
    const drag = useRef<{
        startX: number
        moved: boolean
        pointerType: string
    } | null>(null)
    const swipedRef = useRef(false)

    const onPointerDown = (event: ReactPointerEvent) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        drag.current = {
            startX: event.clientX,
            moved: false,
            pointerType: event.pointerType,
        }
        swipedRef.current = false
        setPaused(true)
    }
    const onPointerMove = (event: ReactPointerEvent) => {
        const state = drag.current
        if (!state) return
        if (Math.abs(event.clientX - state.startX) > 8) state.moved = true
    }
    const endDrag = (event: ReactPointerEvent) => {
        const state = drag.current
        drag.current = null
        setPaused(false)
        if (!state) return
        if (state.pointerType !== 'mouse') {
            swipedRef.current = state.moved
            return
        }
        const dx = event.clientX - state.startX
        if (Math.abs(dx) >= SWIPE_THRESHOLD) {
            swipedRef.current = true
            go(active + (dx < 0 ? 1 : -1))
        }
    }

    useEffect(() => {
        if (paused || count <= 1 || prefersReducedMotion()) return
        const id = setInterval(() => go(active + 1), AUTO_ADVANCE_MS)
        return () => clearInterval(id)
    }, [active, count, go, paused])

    return (
        <section
            aria-roledescription="캐러셀"
            aria-label="프로모션 배너"
            className="home-banner relative overflow-hidden"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            // 드래그로 넘긴 직후의 링크 클릭을 취소(의도치 않은 이동 방지).
            onClickCapture={(event) => {
                if (swipedRef.current) {
                    event.preventDefault()
                    event.stopPropagation()
                    swipedRef.current = false
                }
            }}
        >
            <div
                ref={trackRef}
                className="home-banner__track flex transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{
                    transform: `translateX(-${active * 100}%)`,
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onScroll={(event) => {
                    if (window.innerWidth >= 640) return
                    const track = event.currentTarget
                    const index = Math.round(
                        track.scrollLeft / (track.clientWidth + 12),
                    )
                    if (index === count) {
                        setActive(0)
                        loopResetPendingRef.current = true
                        if (loopResetRef.current) {
                            clearTimeout(loopResetRef.current)
                        }
                        loopResetRef.current = setTimeout(() => {
                            loopResetPendingRef.current = false
                            resetLoopPosition(track)
                            loopResetRef.current = null
                        }, 700)
                    } else if (
                        index >= 0 &&
                        index < count &&
                        index !== active
                    ) {
                        loopResetPendingRef.current = false
                        if (loopResetRef.current) {
                            clearTimeout(loopResetRef.current)
                            loopResetRef.current = null
                        }
                        setActive(index)
                    }
                }}
            >
                {renderedSlides.map((slide, index) => {
                    const isLoopClone = index === count
                    const isActive = !isLoopClone && index === active
                    return (
                        <div
                            key={isLoopClone ? `${slide.id}-loop` : slide.id}
                            role="group"
                            aria-roledescription="슬라이드"
                            aria-label={`${index + 1} / ${count}`}
                            aria-hidden={isLoopClone || !isActive}
                            data-active={isActive}
                            data-loop-clone={isLoopClone || undefined}
                            className="home-banner__slide-shell w-full shrink-0"
                        >
                            <Link
                                to={slide.href}
                                aria-label={`${slide.title}, ${slide.cta}`}
                                tabIndex={isActive ? 0 : -1}
                                className={`home-banner__slide relative flex flex-col justify-center overflow-hidden bg-gradient-to-br text-on-strong ${slide.surface}`}
                            >
                                <span
                                    aria-hidden
                                    className="home-banner__glow"
                                />
                                <span className="home-banner__content flex flex-col items-start">
                                    <span className="flex items-center gap-2">
                                        <span className="home-banner__tag rounded-full bg-brand-highlight-bright text-chrome-strong">
                                            {slide.tag}
                                        </span>
                                        {slide.subTag && (
                                            <span className="home-banner__subtag rounded-full bg-content-surface/20 font-bold text-on-strong">
                                                {slide.subTag}
                                            </span>
                                        )}
                                    </span>
                                    <span className="home-banner__title max-w-md font-extrabold leading-tight">
                                        {slide.title}
                                    </span>
                                    <span className="home-banner__description max-w-md text-on-strong/80">
                                        {slide.description}
                                    </span>
                                    <span className="home-banner__cta inline-flex w-fit items-center gap-1 font-bold">
                                        {slide.cta}
                                        <TbChevronRight
                                            aria-hidden
                                            className="size-4"
                                        />
                                    </span>
                                </span>

                                <SlideArt art={slide.art} />
                            </Link>
                        </div>
                    )
                })}
            </div>

            {/* 이전/다음 — 데스크톱에서만 노출(모바일은 스와이프 대신 도트) */}
            <button
                type="button"
                aria-label="이전 배너"
                className="home-banner__arrow home-banner__arrow--previous absolute left-4 top-1/2 hidden -translate-y-1/2 place-items-center text-on-strong sm:grid"
                onClick={() => go(active - 1)}
            >
                <TbChevronLeft aria-hidden className="size-5" />
            </button>
            <button
                type="button"
                aria-label="다음 배너"
                className="home-banner__arrow home-banner__arrow--next absolute right-4 top-1/2 hidden -translate-y-1/2 place-items-center text-on-strong sm:grid"
                onClick={() => go(active + 1)}
            >
                <TbChevronRight aria-hidden className="size-5" />
            </button>

            {/* 페이지네이션 인디케이터 */}
            <div className="home-banner__pagination absolute flex items-center gap-2">
                {SLIDES.map((slide, index) => {
                    const isActive = index === active
                    return (
                        <button
                            key={slide.id}
                            type="button"
                            aria-label={`${index + 1}번 배너로 이동`}
                            aria-current={isActive}
                            data-active={isActive}
                            className={`home-banner__dot rounded-full transition-all ${
                                isActive
                                    ? 'bg-content-surface'
                                    : 'bg-content-surface/50 hover:bg-content-surface/80'
                            }`}
                            onClick={() => go(index)}
                        />
                    )
                })}
            </div>
        </section>
    )
}

export default HomeBanner
