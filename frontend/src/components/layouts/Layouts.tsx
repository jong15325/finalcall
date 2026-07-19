import { Suspense } from 'react'
import Loading from '@/components/shared/Loading'
import AppShell from './AppShell'
import type { CommonProps } from '@/@types/common'

/**
 * 레이아웃 진입점 (FC-057 — 레이아웃 B).
 *
 * ★★ **인증 분기를 걷어냈다.** 종전에는 `authenticated` 로 `PostLoginLayout`/`PreLoginLayout`
 *    을 갈랐고, 그래서 비로그인은 셸 없는 화면을 봤다. 이제 **전 화면이 하나의 `AppShell`**
 *    을 쓴다 — 인증에 따라 바뀌는 것은 셸의 존재가 아니라 셸 안의 내용물이다.
 *    상세 근거는 `AppShell/AppShell.tsx` 주석.
 *
 * ★ 인증 폼(`/login`·`/signup`)도 같은 셸을 쓴다. 커머스에서 로그인은 "격리된 관문"이 아니라
 *   둘러보다 들르는 한 페이지다. 폼 자체의 레이아웃은 FC-060 소관이다.
 *
 * ★ 템플릿의 `PostLoginLayout`(사이드바 6종)·`PreLoginLayout`·`AuthLayout` 은 **이제 앱에서
 *   참조되지 않는다.** 파일은 남겨뒀다(`ThemeConfigurator/LayoutSwitcher` 가 아직 그 타입을
 *   참조한다) — 정리는 별도 티켓 대상으로 보고했다.
 */
const Layout = ({ children }: CommonProps) => {
    return (
        <Suspense
            fallback={
                <div className="flex h-[100vh] flex-auto flex-col">
                    <Loading loading={true} />
                </div>
            }
        >
            <AppShell>{children}</AppShell>
        </Suspense>
    )
}

export default Layout
