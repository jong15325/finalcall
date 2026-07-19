import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import Views from '@/views'
import { queryClient } from '@/lib/queryClient'
import appConfig from './configs/app.config'

if (appConfig.enableMock) {
    import('./mock')
}

/**
 * 앱 루트 (FC-055).
 *
 * ★ `QueryClientProvider` 를 템플릿 트리에 얹었다 — 서버 상태는 react-query 로 간다(FC-055 판단).
 *   `AuthProvider` 바깥에 두어 인증 훅도 쿼리를 쓸 수 있게 한다.
 */
function App() {
    return (
        <Theme>
            <BrowserRouter>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <Layout>
                            <Views />
                        </Layout>
                    </AuthProvider>
                </QueryClientProvider>
            </BrowserRouter>
        </Theme>
    )
}

export default App
