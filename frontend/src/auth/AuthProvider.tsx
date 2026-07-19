import { useCallback, useMemo } from 'react'
import AuthContext from './AuthContext'
import { useAuthStore } from '@/store/authStore'
import {
    getMe,
    login as apiLogin,
    logout as apiLogout,
    signup as apiSignup,
} from '@/lib/api/auth'
import type { AuthContextValue } from './AuthContext'
import type { LoginRequest, SignupRequest } from '@/lib/api/auth'
import type { ReactNode } from 'react'

/**
 * 인증 프로바이더 (FC-056 — 전송로를 `apiClient` 로 통일하며 재작성).
 *
 * ★ 리다이렉트를 여기서 하지 않는다. 템플릿 원본은 provider 안에 `IsolatedNavigator` 를 심어
 *   로그인 성공 시 직접 `navigate` 했는데, 그러면 **인증 상태와 화면 이동이 한 곳에 엉킨다.**
 *   우리는 `PublicRoute`/`ProtectedRoute` 가 `authenticated` 를 보고 선언적으로 처리한다 —
 *   상태가 바뀌면 라우터가 알아서 따라온다.
 */

interface AuthProviderProps {
    children: ReactNode
}

function AuthProvider({ children }: AuthProviderProps) {
    const accessToken = useAuthStore((state) => state.accessToken)
    const user = useAuthStore((state) => state.user)
    const updateTokens = useAuthStore((state) => state.updateTokens)
    const setUser = useAuthStore((state) => state.setUser)
    const clearSession = useAuthStore((state) => state.clearSession)

    const signIn = useCallback(
        async (credential: LoginRequest) => {
            const tokens = await apiLogin(credential)

            /*
             * ★ 토큰을 먼저 심고 `GET /me` 를 부른다 — 계약 §2 로그인 응답에는 **사용자 정보가
             *   없다**(토큰 3종뿐). 프로필은 §2.5 의 별도 호출로만 얻는다.
             *   `apiClient` 가 스토어에서 토큰을 읽으므로 순서가 이렇게 강제된다.
             */
            updateTokens(tokens)

            try {
                const me = await getMe()
                setUser({
                    userPublicId: me.userPublicId,
                    nickname: me.nickname,
                    isAdmin: me.isAdmin,
                })
            } catch (error) {
                // 프로필 조회가 깨지면 반쪽 세션을 남기지 않는다 — 실패로 되돌린다.
                clearSession()
                throw error
            }
        },
        [updateTokens, setUser, clearSession],
    )

    const signUp = useCallback(async (credential: SignupRequest) => {
        // 계약 §2 — 가입 응답은 `{ userPublicId, nickname }` 이고 토큰이 없다. 자동 로그인 없음.
        await apiSignup(credential)
    }, [])

    const signOut = useCallback(async () => {
        const { refreshToken } = useAuthStore.getState()
        try {
            // 서버 저장 refresh 를 폐기해야 로그아웃이 완결된다(SEC-006).
            if (refreshToken) await apiLogout(refreshToken)
        } finally {
            // 서버 호출이 실패해도 로컬 세션은 반드시 비운다.
            clearSession()
        }
    }, [clearSession])

    const value = useMemo<AuthContextValue>(
        () => ({
            authenticated: accessToken !== null,
            user,
            signIn,
            signUp,
            signOut,
        }),
        [accessToken, user, signIn, signUp, signOut],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
