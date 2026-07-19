import ProtectedRoute from './ProtectedRoute'
import PublicRoute from './PublicRoute'
import AuthorityGuard from './AuthorityGuard'
import AppRoute from './AppRoute'
import PageContainer from '@/components/template/PageContainer'
import {
    protectedRoutes,
    publicRoutes,
    sharedRoutes,
    ROUTES,
} from '@/configs/routes.config'
import { useAuth } from '@/auth'
import { Routes, Route, Navigate } from 'react-router'
import type { LayoutType } from '@/@types/theme'

interface ViewsProps {
    pageContainerType?: 'default' | 'gutterless' | 'contained'
    layout?: LayoutType
}

type AllRoutesProps = ViewsProps

/**
 * 라우트 트리 (FC-055 개편).
 *
 * ★ **버킷 셋** — `sharedRoutes` 는 가드 없이 그대로 건다(비로그인·로그인 공통). 근거는
 *   `configs/routes.config/routes.config.ts` 상단 주석 참조. 공개 커머스라 홈·목록·상세가
 *   로그인 여부로 갈리면 안 된다.
 *
 * ★ **catch-all 을 ProtectedRoute 밖으로 뺐다.** 템플릿은 `*` 를 보호 구역 **안**에 두어
 *   비로그인이 오타 URL 로 들어오면 404 가 아니라 **로그인 화면으로 튕겼다**. 없는 페이지는
 *   인증 문제가 아니다.
 *   지금은 홈으로 보내지만 **전용 404 화면이 옳다**(주소를 조용히 갈아끼우면 오타를 알 수 없다).
 *   화면 제작이 이 티켓 범위 밖이라 후속 티켓으로 남긴다.
 */
const AllRoutes = (props: AllRoutesProps) => {
    const { user } = useAuth()

    return (
        <Routes>
            {/* 공통 — 가드 없음 */}
            {sharedRoutes.map((route) => (
                <Route
                    key={route.key}
                    path={route.path}
                    element={
                        <PageContainer {...props} {...route.meta}>
                            <AppRoute
                                routeKey={route.key}
                                component={route.component}
                                {...route.meta}
                            />
                        </PageContainer>
                    }
                />
            ))}

            {/* 로그인 필수 */}
            <Route path="/" element={<ProtectedRoute />}>
                {protectedRoutes.map((route, index) => (
                    <Route
                        key={route.key + index}
                        path={route.path}
                        element={
                            <AuthorityGuard
                                userAuthority={user.authority}
                                authority={route.authority}
                            >
                                <PageContainer {...props} {...route.meta}>
                                    <AppRoute
                                        routeKey={route.key}
                                        component={route.component}
                                        {...route.meta}
                                    />
                                </PageContainer>
                            </AuthorityGuard>
                        }
                    />
                ))}
            </Route>

            {/* 비로그인 전용(인증 폼) */}
            <Route path="/" element={<PublicRoute />}>
                {publicRoutes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={
                            <AppRoute
                                routeKey={route.key}
                                component={route.component}
                                {...route.meta}
                            />
                        }
                    />
                ))}
            </Route>

            <Route path="*" element={<Navigate replace to={ROUTES.home} />} />
        </Routes>
    )
}

export default AllRoutes
