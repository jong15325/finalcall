import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import { paths } from '@/app/paths'
import { itemArt } from '@/features/item/lib/itemArt'
import type { ItemArtInput } from '@/features/item/lib/itemArt'

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
        surface: 'from-navy-900 via-navy-800 to-gold-deep',
        art: [
            { subGroup: 1, kind: 3, element: 2, level: 9 },
            { subGroup: 1, kind: 1, element: 3, level: 9 },
        ],
    },
    {
        id: 'auction',
        tag: 'REALTIME AUCTION',
        title: '마감 임박 경매를 확인하세요',
        description: '단 20분 남은 레전드 장비. 지금 입찰에 참여할 수 있습니다.',
        cta: '경매 참여하기',
        href: paths.auctions,
        surface: 'from-navy-900 via-navy-700 to-orange-deep',
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
        surface: 'from-navy-800 via-navy-600 to-navy-500',
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
            className="pointer-events-none absolute inset-y-0 right-4 hidden items-center gap-1 sm:right-8 md:flex"
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
                        className={`drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] [image-rendering:pixelated] ${
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
                                aria-label={`${slide.title}, ${slide.cta}`}
                                tabIndex={isActive ? 0 : -1}
                                className={`relative flex min-h-[200px] flex-col justify-center gap-2.5 overflow-hidden bg-gradient-to-br px-6 py-8 text-white sm:min-h-[248px] sm:px-10 ${slide.surface}`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="rounded-full bg-gold-bright px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-navy-900">
                                        {slide.tag}
                                    </span>
                                    {slide.subTag && (
                                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white">
                                            {slide.subTag}
                                        </span>
                                    )}
                                </span>
                                <span className="max-w-md text-2xl font-extrabold leading-tight sm:text-[32px]">
                                    {slide.title}
                                </span>
                                <span className="max-w-md text-sm text-white/80">
                                    {slide.description}
                                </span>
                                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur-sm">
                                    {slide.cta}
                                    <TbChevronRight
                                        aria-hidden
                                        className="size-4"
                                    />
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

            {/* 페이지네이션 인디케이터 */}
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
