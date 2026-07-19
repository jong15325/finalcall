import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import Views from '@/views'
import { queryClient } from '@/lib/queryClient'

/**
 * 앱 루트 (FC-055 → FC-056).
 *
 * ★ `QueryClientProvider` 를 템플릿 트리에 얹었다 — 서버 상태는 react-query 로 간다(FC-055 판단).
 *   `AuthProvider` 바깥에 두어 인증 훅도 쿼리를 쓸 수 있게 한다.
 *
 * ★ **목 어댑터를 제거했다**(FC-056). 템플릿의 mock 은 axios 인터셉터라 전송로를 `apiClient`
 *   하나로 합치면서 함께 사라졌다. 실백엔드에 붙었는지 아닌지가 화면상 구분되지 않는 상태를
 *   만들지 않는 편이 낫다 — FC-055 가 `enableMock: false` 로 껐던 이유와 같다.
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
