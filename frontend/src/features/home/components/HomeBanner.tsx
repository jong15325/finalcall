import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import { paths } from '@/app/paths'

/**
 * 홈 배너 캐러셀 — 목업 `#home` 구조 이식(Swiper 등 **의존성 없이** 최소 React/CSS).
 *
 * ★ **deps 추가 금지**(FC-069 정리) — `translateX` 트랙 + `setInterval` 만으로 자동넘김·
 *   페이지네이션을 구현한다. 슬라이드 전환은 CSS transform, 상태는 활성 인덱스 하나뿐이다.
 * ★ **접근성**: 비활성 슬라이드는 `aria-hidden` + 링크 `tabIndex=-1`(화면 밖으로 초점 유출 차단).
 *   자동넘김은 `prefers-reduced-motion` 이면 멈추고(WCAG 2.2.2), hover/focus 중에도 멈춘다.
 *   도트는 실제 `<button>`(키보드 조작) + `aria-current`.
 * ★ 색은 브랜드 토큰(navy/gold/orange, §2.9) — 목업 이미지 자산이 없어 그라데이션 슬라이드로
 *   구조를 재현한다(임의 이미지 하드코딩 금지). CTA 는 실연동 라우트로만 건다(404 방지, §5).
 */

interface BannerSlide {
    id: string
    eyebrow: string
    title: string
    description: string
    cta: string
    href: string
    /** 브랜드 그라데이션(배경) */
    surface: string
}

const SLIDES: BannerSlide[] = [
    {
        id: 'closing',
        eyebrow: '지금 이 순간',
        title: '마감 임박 경매',
        description: '초 단위로 바뀌는 최고가. 마감 전에 마지막 한 수를 두세요.',
        cta: '경매 보러 가기',
        href: paths.auctions,
        surface: 'from-navy-900 via-navy-800 to-navy-600',
    },
    {
        id: 'trust',
        eyebrow: '안전한 거래',
        title: '에스크로로 지키는 거래, 장터',
        description: '낙찰부터 정산까지 게임머니를 안전하게 묶어 둡니다.',
        cta: '경매 둘러보기',
        href: paths.auctions,
        surface: 'from-navy-800 via-navy-700 to-orange-deep',
    },
    {
        id: 'join',
        eyebrow: '처음이신가요',
        title: '내 아이템을 경매로 내놓기',
        description: '가입하고 인벤토리의 아이템을 바로 출품해 보세요.',
        cta: '가입하고 시작하기',
        href: paths.signup,
        surface: 'from-gold-deep via-orange-deep to-orange',
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

function HomeBanner() {
    const [active, setActive] = useState(0)
    const [paused, setPaused] = useState(false)
    const count = SLIDES.length

    const go = (index: number) => setActive((index + count) % count)

    useEffect(() => {
        if (paused || count <= 1 || prefersReducedMotion()) return
        const id = setInterval(
            () => setActive((value) => (value + 1) % count),
            AUTO_ADVANCE_MS,
        )
        return () => clearInterval(id)
    }, [paused, count])

    return (
        <section
            aria-roledescription="캐러셀"
            aria-label="프로모션 배너"
            className="relative overflow-hidden rounded-2xl"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            <div
                className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
                style={{ transform: `translateX(-${active * 100}%)` }}
            >
                {SLIDES.map((slide, index) => {
                    const isActive = index === active
                    return (
                        <div
                            key={slide.id}
                            role="group"
                            aria-roledescription="슬라이드"
                            aria-label={`${index + 1} / ${count}`}
                            aria-hidden={!isActive}
                            className="w-full shrink-0"
                        >
                            <Link
                                to={slide.href}
                                tabIndex={isActive ? 0 : -1}
                                className={`flex min-h-[188px] flex-col justify-center gap-2.5 bg-gradient-to-br px-6 py-8 text-white sm:min-h-[224px] sm:px-10 ${slide.surface}`}
                            >
                                <span className="text-xs font-bold uppercase tracking-wide text-white/70">
                                    {slide.eyebrow}
                                </span>
                                <span className="max-w-xl text-2xl font-extrabold leading-tight sm:text-[32px]">
                                    {slide.title}
                                </span>
                                <span className="max-w-lg text-sm text-white/80">
                                    {slide.description}
                                </span>
                                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur-sm">
                                    {slide.cta}
                                    <TbChevronRight aria-hidden className="size-4" />
                                </span>
                            </Link>
                        </div>
                    )
                })}
            </div>

            {/* 이전/다음 — 데스크톱에서만 노출(모바일은 스와이프 대신 도트) */}
            <button
                type="button"
                aria-label="이전 배너"
                className="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/40 sm:grid"
                onClick={() => go(active - 1)}
            >
                <TbChevronLeft aria-hidden className="size-5" />
            </button>
            <button
                type="button"
                aria-label="다음 배너"
                className="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/40 sm:grid"
                onClick={() => go(active + 1)}
            >
                <TbChevronRight aria-hidden className="size-5" />
            </button>

            {/* 페이지네이션 도트 */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
                {SLIDES.map((slide, index) => {
                    const isActive = index === active
                    return (
                        <button
                            key={slide.id}
                            type="button"
                            aria-label={`${index + 1}번 배너로 이동`}
                            aria-current={isActive}
                            className={`h-2 rounded-full transition-all ${
                                isActive
                                    ? 'w-5 bg-white'
                                    : 'w-2 bg-white/50 hover:bg-white/80'
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
