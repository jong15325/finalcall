import { Link, Outlet, useLocation } from 'react-router'
import BrandLogo from '@/components/brand/BrandLogo'
import { paths } from '@/app/paths'

/**
 * 인증 레이아웃 (FC-067) — 로그인·회원가입.
 *
 * ★ 앱 셸(사이드바·상단바)을 쓰지 않는다. 브랜드만 얹은 중앙 정렬 최소 레이아웃 —
 *   인증 화면은 좌측 메뉴에서 제거되어 있다(HANDOVER §5.1).
 * ★ 회원가입은 입력 항목이 많아 목업(`is-signup` ~560px)처럼 카드를 넓게 준다(`max-w-xl`).
 *   로그인은 기존 폭(`max-w-md`)을 유지한다(FC-080 — login 회귀 없음).
 */
function AuthLayout() {
    const isSignup = useLocation().pathname === paths.signup
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-content-soft px-4 py-10">
            <Link to={paths.home} aria-label="장터 홈" className="mb-8">
                <BrandLogo className="max-h-10" />
            </Link>
            <div
                className={`w-full rounded-2xl border border-content-line bg-content-surface p-6 shadow-sm sm:p-8 ${
                    isSignup ? 'max-w-xl' : 'max-w-md'
                }`}
            >
                <Outlet />
            </div>
        </div>
    )
}

export default AuthLayout
