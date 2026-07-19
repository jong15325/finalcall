import { Link } from 'react-router'
import { PiArrowRightBold } from 'react-icons/pi'
import Button from '@/components/ui/Button'
import type { ReactElement, ReactNode } from 'react'

/**
 * 홈 섹션 껍데기 (FC-058 → 재작업).
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **제목·설명은 데이터와 무관하므로 즉시 렌더된다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 요청이 끝나기를 기다렸다가 섹션 전체를 그리면 **첫 화면이 잠깐 백지**가 된다. 껍데기는
 * 항상 서 있고 **안쪽 내용만** 로딩/빈/에러/데이터로 바뀐다. 그래서 이 컴포넌트는 쿼리를
 * 알지 못한다 — 상태는 자식이 갖는다. 그것이 **에러 격리의 화면 쪽 절반**이다.
 *
 * ★ **아이콘은 장식이 아니라 이정표다**(피드백 8·9). 스크롤하며 섹션을 건너뛸 때 글자를
 *   읽기 전에 모양이 먼저 걸린다. 그래서 섹션마다 **다른 모양**이어야 의미가 있고,
 *   전부 같은 모양이면 붙이지 않느니만 못하다. `aria-hidden` — 제목이 이미 말한다.
 *
 * ★ 제목 옆 얇은 구분선(`flex-1` hairline)이 헤더를 가로로 묶는다. 빈 공간이 무너지지 않게
 *   잡아주는 값싼 장치이고, 색은 템플릿 `gray-200/gray-700` 이다.
 */

interface HomeSectionProps {
    title: string
    description?: string
    /** 섹션 이정표 아이콘. 섹션마다 달라야 한다 */
    icon?: ReactElement
    /** 더 보기 링크. 목적지가 실제로 있을 때만 준다 */
    moreTo?: string
    moreLabel?: string
    children: ReactNode
}

const HomeSection = ({
    title,
    description,
    icon,
    moreTo,
    moreLabel = '더 보기',
    children,
}: HomeSectionProps) => {
    return (
        <section className="flex flex-col gap-4">
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                    {icon && (
                        <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-lg text-white dark:bg-gray-100 dark:text-gray-900"
                        >
                            {icon}
                        </span>
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {title}
                        </h2>
                        {description && (
                            <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {moreTo && (
                    <Link to={moreTo} className="shrink-0">
                        <Button
                            size="xs"
                            icon={<PiArrowRightBold />}
                            iconAlignment="end"
                        >
                            {moreLabel}
                        </Button>
                    </Link>
                )}
            </header>
            {children}
        </section>
    )
}

export default HomeSection
