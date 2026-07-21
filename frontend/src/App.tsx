import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/auth'
import { queryClient } from '@/lib/queryClient'
import AppRoutes from '@/app/router'

/**
 * 앱 루트 (FC-067 재구축 — 템플릿 Theme/Layout/Views 제거).
 *
 * ★ 프로바이더 순서: Router → QueryClient → Auth. `test/renderWithProviders` 와 **같은 순서**로
 *   맞춘다 — 순서가 어긋나면 테스트는 통과하는데 앱에서 훅이 컨텍스트를 못 찾는 상황이 난다.
 * ★ 목 어댑터 없음(FC-056 판단 승계). 전송로는 `apiClient` 하나.
 */
function App() {
    return (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    )
}

export default App
