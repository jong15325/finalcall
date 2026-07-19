import { Link } from 'react-router'
import Button from '@/components/ui/Button'
import type { ReactNode } from 'react'

/**
 * 홈 섹션 껍데기 (FC-058).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **제목·설명은 데이터와 무관하므로 즉시 렌더된다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 요청이 끝나기를 기다렸다가 섹션 전체를 그리면 **첫 화면이 잠깐 백지**가 된다. 껍데기는
 * 항상 서 있고 **안쪽 내용만** 로딩/빈/에러/데이터로 바뀐다. 그래서 이 컴포넌트는 쿼리를
 * 알지 못한다 — 상태는 자식이 갖는다.
 *
 * ★ 섹션이 자기 상태를 자기 안에서 그리는 것이 **에러 격리의 화면 쪽 절반**이다
 *   (나머지 절반은 섹션마다 쿼리를 따로 두는 것 — `lib/queries/auctions.ts`).
 *   한 섹션이 죽어도 페이지 상단에 전역 배너가 뜨지 않고 그 자리만 대체된다.
 */

interface HomeSectionProps {
    title: string
    description?: string
    /** 더 보기 링크. 목적지가 실제로 있을 때만 준다 */
    moreTo?: string
    moreLabel?: string
    children: ReactNode
}

const HomeSection = ({
    title,
    description,
    moreTo,
    moreLabel = '더 보기',
    children,
}: HomeSectionProps) => {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {title}
                    </h2>
                    {description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {description}
                        </p>
                    )}
                </div>
                {moreTo && (
                    <Link to={moreTo} className="shrink-0">
                        <Button size="xs">{moreLabel}</Button>
                    </Link>
                )}
            </header>
            {children}
        </section>
    )
}

export default HomeSection
