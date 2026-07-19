import { Link } from 'react-router'
import classNames from '@/utils/classNames'
import LinkButton from '@/components/shared/LinkButton'
import BrandWordmark from '@/components/brand/BrandWordmark'
import { useAuth } from '@/auth'
import { ROUTES } from '@/configs/routes.config'
import BalanceIndicator from './BalanceIndicator'

/**
 * 모바일 셸 헤더 (FC-057).
 *
 *   [FINALCALL]  ──[검색 자리]──  [게임머니 가용]  또는  [로그인]
 *
 * ★★ **데스크톱 헤더를 접은 것이 아니다.** 내비가 아예 없다 — 목적지는 **하단 탭바**가 맡는다
 *    (엄지 도달 범위). 상단에 남는 것은 브랜드(현재 위치 확인)와 지금 필요한 숫자 하나뿐이다.
 *    데스크톱 1행에 있던 계정 드롭다운도 여기 없다 — 탭바의 `MY` 가 그 역할이다.
 *
 * ★ 잔액도 **다른 것을 보여준다**: 데스크톱은 캐시+게임머니 두 축, 모바일은 게임머니 가용액
 *   하나. 근거는 `BalanceIndicator` 주석 참조.
 */

const MobileHeader = ({ className }: { className?: string }) => {
    const { authenticated } = useAuth()

    return (
        <header
            className={classNames(
                'sticky top-0 z-30 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
                className,
            )}
        >
            <div className="flex h-14 items-center gap-4 px-4">
                <Link to={ROUTES.home} className="shrink-0">
                    <BrandWordmark size="sm" />
                </Link>

                {/* 검색 자리 — 계약에 파라미터가 없어 컨트롤을 두지 않았다(DesktopHeader 주석). */}
                <div className="flex-1" />

                {authenticated ? (
                    <BalanceIndicator variant="compact" className="shrink-0" />
                ) : (
                    <LinkButton size="xs" to={ROUTES.login}>
                        로그인
                    </LinkButton>
                )}
            </div>
        </header>
    )
}

export default MobileHeader
