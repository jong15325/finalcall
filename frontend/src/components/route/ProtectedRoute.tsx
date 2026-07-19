import appConfig from '@/configs/app.config'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/auth'
import { buildReturnUrlQuery } from '@/lib/returnUrl'

const { unAuthenticatedEntryPath } = appConfig

/**
 * 로그인 필수 라우트.
 *
 * ★ FC-057 — 복귀 대상을 `useLocation()` 에서 읽고 **query·hash 까지 싣는다.** 종전에는
 *   전역 `location.pathname` 만 읽어 (1) 라우터 상태가 아닌 브라우저 전역을 봤고
 *   (2) `?status=OPEN` 같은 필터가 복귀 시 사라졌으며 (3) 인코딩이 없었다.
 *   실제 복귀 처리는 `PublicRoute` 가 한다.
 */
const ProtectedRoute = () => {
    const { authenticated } = useAuth()
    const location = useLocation()

    if (!authenticated) {
        return (
            <Navigate
                replace
                to={`${unAuthenticatedEntryPath}${buildReturnUrlQuery(location)}`}
            />
        )
    }

    return <Outlet />
}

export default ProtectedRoute
