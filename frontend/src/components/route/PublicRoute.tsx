import { Navigate, Outlet, useSearchParams } from 'react-router'
import { useAuth } from '@/auth'
import { REDIRECT_URL_KEY } from '@/constants/app.constant'
import { sanitizeReturnUrl } from '@/lib/returnUrl'

/**
 * 비로그인 전용 라우트(인증 폼).
 *
 * ★ FC-057 — **`redirectUrl` 을 존중한다.** 종전에는 `authenticatedEntryPath`(홈)로만 보내서
 *   `ProtectedRoute` 가 애써 붙여둔 복귀 대상이 **버려졌다**. 판매 등록을 누르고 로그인한
 *   손님이 홈으로 떨어지면 자기가 뭘 하려던 참이었는지를 다시 찾아가야 한다.
 *
 * ★ 값은 반드시 `sanitizeReturnUrl` 을 통과시킨다 — 오픈 리다이렉트 방지(P-011).
 *   파라미터가 없으면 그 함수가 홈(`DEFAULT_RETURN_URL`)을 돌려주므로 종전 동작과 같다.
 */
const PublicRoute = () => {
    const { authenticated } = useAuth()
    const [searchParams] = useSearchParams()

    if (!authenticated) return <Outlet />

    return (
        <Navigate
            replace
            to={sanitizeReturnUrl(searchParams.get(REDIRECT_URL_KEY))}
        />
    )
}

export default PublicRoute
