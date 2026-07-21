import { Navigate, Outlet, useLocation } from 'react-router'
import useAuth from '@/auth/useAuth'
import { buildReturnUrlQuery } from '@/lib/returnUrl'
import { paths } from '@/app/paths'

/**
 * 로그인 필요 라우트 가드 (FC-067 — 구 가드 로직 승계, 셸 재구축에 맞춰 축약).
 *
 * ★ 세션이 없으면 로그인으로 보내되 **보던 곳을 복귀 파라미터로 싣는다**(`buildReturnUrl`).
 *   오픈 리다이렉트 방지는 로그인 성공 처리 쪽(`sanitizeReturnUrl`)이 맡는다.
 * ★ `authenticated` 는 표시·라우팅 가드용일 뿐 **인가가 아니다**(계약 §1.2 — 인가는 서버 권위).
 */
function ProtectedRoute() {
    const { authenticated } = useAuth()
    const location = useLocation()

    if (!authenticated) {
        const query = buildReturnUrlQuery(location)
        return <Navigate replace to={`${paths.login}${query}`} />
    }

    return <Outlet />
}

export default ProtectedRoute
