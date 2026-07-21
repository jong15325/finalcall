import { Link, Outlet } from 'react-router'
import BrandLogo from '@/components/brand/BrandLogo'
import { paths } from '@/app/paths'

/**
 * 인증 레이아웃 (FC-067) — 로그인·회원가입.
 *
 * ★ 앱 셸(사이드바·상단바)을 쓰지 않는다. 브랜드만 얹은 중앙 정렬 최소 레이아웃 —
 *   인증 화면은 좌측 메뉴에서 제거되어 있다(HANDOVER §5.1). 폼 본문은 FC-069가 채운다.
 */
function AuthLayout() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken px-4 py-10">
            <Link to={paths.home} aria-label="장터 홈" className="mb-8">
                <BrandLogo className="max-h-10" />
            </Link>
            <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
                <Outlet />
            </div>
        </div>
    )
}

export default AuthLayout
