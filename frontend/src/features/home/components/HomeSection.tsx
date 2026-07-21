import { Link } from 'react-router'
import { TbChevronRight } from 'react-icons/tb'
import type { ComponentType, ReactNode } from 'react'

/**
 * 홈 섹션 셸 — 제목 + "전체 보기" + 본문(목업 `#home` 섹션 레이아웃).
 *
 * ★ "전체 보기" 는 두 형태다:
 *   - `seeAllHref` — 실연동 목록으로 가는 링크(예: 마감 임박 → `/auctions`).
 *   - `seeAllNote`(+`seeAllDisabled`) — **준비 중/연동 예정** 자리. 링크가 아니라 비활성
 *     `aria-disabled` 표기라 클릭해도 404·데드링크가 없다(§5, 부록 주의 5).
 * ★ 색은 브랜드 토큰. 구조·간격은 목업을 따른다(§2.9).
 */
interface HomeSectionProps {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    title: string
    description?: string
    /** 실연동 "전체 보기" 링크 경로 */
    seeAllHref?: string
    /** 준비 중/연동 예정 등 비활성 표기(링크 대신) */
    seeAllNote?: string
    children: ReactNode
}

function HomeSection({
    icon: Icon,
    title,
    description,
    seeAllHref,
    seeAllNote,
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

                {seeAllHref ? (
                    <Link
                        to={seeAllHref}
                        className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-navy hover:text-orange-deep xs:text-sm"
                    >
                        전체 보기
                        <TbChevronRight aria-hidden className="size-4" />
                    </Link>
                ) : seeAllNote ? (
                    <span
                        aria-disabled="true"
                        className="shrink-0 rounded-full bg-gold-subtle px-2.5 py-1 text-[11px] font-bold text-gold-deep"
                    >
                        {seeAllNote}
                    </span>
                ) : null}
            </header>

            {children}
        </section>
    )
}

export default HomeSection
