import { useAuthStore } from '@/store/authStore'
import type { SessionTokens } from '@/store/authStore'

/**
 * api 클라이언트 ↔ 인증 스토어 브릿지 (FC-056 복원).
 *
 * ★ 클라이언트가 React 훅에 결합되지 않도록 Zustand vanilla API(`getState`)만 쓴다.
 *   `apiClient` 는 컴포넌트 밖(인터셉터·재시도 루프)에서도 토큰을 읽어야 한다.
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

/** 세션 정리 (AUTH_004·refresh 실패 → 재로그인 유도) */
export function clearSession(): void {
    useAuthStore.getState().clearSession()
}
