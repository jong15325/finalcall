import { Navigate, Outlet, useSearchParams } from 'react-router'
import useAuth from '@/auth/useAuth'
import { sanitizeReturnUrl } from '@/lib/returnUrl'
import { REDIRECT_URL_KEY } from '@/constants/app.constant'

/**
 * 비로그인 전용 라우트 가드 (로그인·회원가입) — FC-067.
 *
 * ★ 이미 세션이 있으면 인증 화면을 보여줄 이유가 없다 → 복귀 URL(있으면)이나 홈으로 되돌린다.
 *   복귀 URL 은 사용자가 고를 수 있는 값이라 **반드시 정화**한다(오픈 리다이렉트 방지).
 */
function PublicRoute() {
    const { authenticated } = useAuth()
    const [searchParams] = useSearchParams()

    if (authenticated) {
        const target = sanitizeReturnUrl(searchParams.get(REDIRECT_URL_KEY))
        return <Navigate replace to={target} />
    }

    return <Outlet />
}

export default PublicRoute
