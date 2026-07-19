import { lazy } from 'react'
import ProtectedRoute from './ProtectedRoute'
import PublicRoute from './PublicRoute'
import AuthorityGuard from './AuthorityGuard'
import AppRoute from './AppRoute'
import PageContainer from '@/components/template/PageContainer'
import {
    protectedRoutes,
    publicRoutes,
    sharedRoutes,
} from '@/configs/routes.config'
import { useUserAuthority } from '@/store/authStore'
import { Routes, Route } from 'react-router'
import type { LayoutType } from '@/@types/theme'

const NotFound = lazy(() => import('@/views/others/NotFound'))

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
 *
 * ★ FC-057 — 그 자리에 **전용 404 화면**을 넣었다. 종전에는 `<Navigate to="/" />` 라 주소가
 *   조용히 홈으로 갈려 손님이 오타를 알 수 없었다.
 */
const AllRoutes = (props: AllRoutesProps) => {
    // 권한 배열은 세션의 `isAdmin` 에서 파생한다(표시 제어 — 인가는 서버, 계약 §1.2).
    const userAuthority = useUserAuthority()

    /*
     * ★ `footer={false}` — 푸터는 **셸이 소유한다**(`AppShell/AppFooter`, FC-057).
     *   템플릿 `PageContainer` 기본값은 `footer: true` 이고 그러면 `template/Footer`("Ecme"
     *   저작권 + `preventDefault` 로 막아둔 링크 2개)가 화면마다 붙는다. `route.meta` 뒤에
     *   두어 개별 라우트가 되살리지 못하게 한다 — 푸터가 두 벌이 되면 안 된다.
     */
    return (
        <Routes>
            {/* 공통 — 가드 없음 */}
            {sharedRoutes.map((route) => (
                <Route
                    key={route.key}
                    path={route.path}
                    element={
                        <PageContainer
                            {...props}
                            {...route.meta}
                            footer={false}
                        >
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
                                userAuthority={userAuthority}
                                authority={route.authority}
                            >
                                <PageContainer
                                    {...props}
                                    {...route.meta}
                                    footer={false}
                                >
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

            {/*
             * ★ **전용 404**(FC-057). 종전 `<Navigate to="/" />` 는 오타 URL 을 조용히 홈으로
             *   갈아끼워 손님이 오타를 알 수 없게 했다. 주소는 그대로 두고 화면으로 알린다.
             */}
            <Route
                path="*"
                element={
                    <PageContainer {...props} footer={false}>
                        <NotFound />
                    </PageContainer>
                }
            />
        </Routes>
    )
}

export default AllRoutes
