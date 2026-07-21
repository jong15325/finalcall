import { Link } from 'react-router'
import { TbChevronRight } from 'react-icons/tb'
import type { ComponentType, ReactNode } from 'react'

/**
 * 홈 섹션 셸 — 제목·캡션 + "전체 보기/더 보기" + 본문(목업 `#home` `home-recommend-head` 1:1).
 *
 * ★ head·caption 은 **목업 문구 그대로** 넣는다(구조 보존). "전체 보기" 링크는 실연동/준비 중
 *   페이지로만 건다 — 목업 CTA 대상이 곧 라우트다(`/auctions`·`/market`·`/community`). 준비 중
 *   페이지(`/market`·`/community`)는 404 가 아니라 안내 셸이라 링크로 두어도 데드링크가 아니다.
 * ★ "준비 중"·"연동 예정" 자리보류 표기는 **본문**이 낸다(데이터 자리보류) — 헤드는 목업 유지.
 * ★ 색은 브랜드 토큰. 구조·간격은 목업을 따른다(§2.9).
 */
interface HomeSectionProps {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description?: string
    /** "전체 보기" 링크 경로 */
    seeAllHref: string
    /** 링크 문구(기본 "전체 보기"). 공지는 "더 보기". */
    seeAllLabel?: string
    children: ReactNode
}

function HomeSection({
    icon: Icon,
    title,
    description,
    seeAllHref,
    seeAllLabel = '전체 보기',
    children,
}: HomeSectionProps) {
    return (
        <section className="flex flex-col gap-3">
            <header className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 xs:text-xl">
                        <Icon aria-hidden className="size-5 text-navy" />
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 truncate text-xs text-gray-500 xs:text-sm">
                            {description}
                        </p>
                    )}
                </div>

                <Link
                    to={seeAllHref}
                    className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-navy hover:text-orange-deep xs:text-sm"
                >
                    {seeAllLabel}
                    <TbChevronRight aria-hidden className="size-4" />
                </Link>
            </header>

            {children}
        </section>
    )
}

export default HomeSection
