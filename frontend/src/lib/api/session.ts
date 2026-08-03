import { useAuthStore } from '@/store/authStore'
import { queryClient } from '@/lib/queryClient'
import { invalidateRefresh } from './client'
import type { SessionTokens } from '@/store/authStore'

/**
 * api 클라이언트 ↔ 인증 스토어 브릿지 (FC-056 복원 · FC-174 원자적 전환).
 *
 * ★ 클라이언트가 React 훅에 결합되지 않도록 Zustand vanilla API(`getState`)만 쓴다.
 *   `apiClient` 는 컴포넌트 밖(인터셉터·재시도 루프)에서도 토큰을 읽어야 한다.
 *
 * ★★ **세션 리셋의 단일 오케스트레이터**(FC-174, spec §3.2). 로그아웃·로그인 진입·탈퇴·
 *    refresh 실패 어느 경로든 (store 상태 + react-query 캐시 + in-flight refresh)를 **원자 페어**로
 *    비운다. 한 계정 상태가 다른 계정에 잔존/노출되는 창을 없앤다.
 */

export function getAccessToken(): string | null {
    return useAuthStore.getState().accessToken
}

export function getRefreshToken(): string | null {
    return useAuthStore.getState().refreshToken
}

/** refresh 회전 결과 반영 (계약 §2 — 신규 refreshToken 저장) */
export function applyRotatedTokens(tokens: SessionTokens): void {
    useAuthStore.getState().updateTokens(tokens)
}

/**
 * 세션 상태 + in-flight refresh 를 비운다 — **캐시는 제외**한다(FC-174, spec §4.3).
 *
 * ★ react-query 캐시 축출은 호출자가 **자신의 대상 클라이언트**에 수행한다:
 *   - React 핸들러(AuthProvider·MePage)는 `useQueryClient()`(컨텍스트 클라이언트).
 *   - 비-React 모듈 경로(client.ts refresh 실패)는 아래 `resetSession()`(모듈 싱글턴).
 *   테스트가 매번 새 클라이언트를 주입하므로 이 이원 배선이 필요하다(spec §4.3-a).
 */
export function resetSessionState(): void {
    useAuthStore.getState().clearSession()
    invalidateRefresh()
}

/**
 * 세션 전량 리셋 (비-React 모듈 경로 전용, spec §3.2·§4.3).
 * store 상태 + **모듈 싱글턴 `queryClient` 캐시** + in-flight refresh 를 원자적으로 비운다.
 *
 * ★ 프로덕션은 App 이 이 싱글턴을 Provider 에 주입하므로 컨텍스트 클라이언트와 동일 인스턴스다.
 *   React 핸들러는 컨텍스트 클라이언트로 clear 해야 테스트에서 단언 가능하므로 `resetSessionState()`
 *   + 자신의 `queryClient.clear()` 를 쓴다(§4.3-a). 이 함수는 refresh 실패 등 모듈 경로용이다.
 */
export function resetSession(): void {
    resetSessionState()
    queryClient.clear()
}
