import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

/**
 * 인증 세션 주입.
 *
 * `useMe` 등 보호 리소스 훅은 `enabled: isAuthed` 로 걸려 있어 **세션이 없으면 요청 자체가 나가지 않는다**
 * — 스텁을 아무리 정확히 깔아도 화면이 빈 채로 남는다. 실제 앱에서는 ProtectedLayout 이 이 상태를
 * 로그인으로 돌려보내므로 도달 불가능한 상태다.
 *
 * authStore 는 모듈 싱글턴이라 테스트 간에 샌다 — setup.ts 가 매 테스트 후 `clearSession` 한다.
 */
export function signIn(nickname = '시험계정'): void {
  useAuthStore.getState().setSession({
    accessToken: 'test-access-token',
    accessExpiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    refreshToken: 'test-refresh-token',
    user: { userPublicId: 'user-0001', nickname, isAdmin: false },
  });
}

/**
 * 테스트 렌더 헬퍼(FC-051).
 *
 * 앱 Provider(라우터·react-query)를 씌운다. 라우터는 `BrowserRouter` 가 아니라 `MemoryRouter` 다 —
 * jsdom 의 history 를 공유하면 테스트 간 URL 이 새어 나간다.
 *
 * QueryClient 는 **테스트마다 새로 만든다.** 앱의 싱글턴(`lib/queryClient.ts`)을 재사용하면
 * 캐시가 테스트 사이에 남아 순서 의존이 생긴다. 재시도·폴링은 끈다(실패 테스트가 몇 초씩 늘어진다).
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchInterval: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

interface RenderOptions {
  /**
   * 초기 URL(쿼리스트링 포함). `useSearchParams` 를 쓰는 화면에 필요하다.
   * 라우트 파라미터(`useParams`)가 필요하면 호출부에서 `<Routes>` 를 함께 넘긴다.
   */
  route?: string;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const { route = '/' } = options;
  const client = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
