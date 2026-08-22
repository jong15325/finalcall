import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import AuthContext from './AuthContext'
import { useAuthStore } from '@/store/authStore'
import { resetSessionState } from '@/lib/api/session'
import {
    getMe,
    login as apiLogin,
    logout as apiLogout,
    oauthLogin as apiOauthLogin,
    signup as apiSignup,
} from '@/lib/api/auth'
import type { AuthContextValue } from './AuthContext'
import type { LoginRequest, SignupRequest } from '@/lib/api/auth'
import type { OAuthProvider } from '@/features/auth/lib/oauth'
import type { SessionTokens } from '@/store/authStore'
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
    const queryClient = useQueryClient()

    /*
     * ★★ **세션 전환의 원자 리셋**(FC-174, spec §4.3-a). store 상태 + in-flight refresh 는
     *    `resetSessionState()`(모듈 브릿지)로, react-query 캐시는 **컨텍스트 클라이언트**로 비운다.
     *    프로덕션은 App 이 싱글턴을 주입하므로 이 clear 가 곧 싱글턴 clear 이고, 테스트는 주입한
     *    클라이언트를 그대로 clear 해 캐시 축출을 단언할 수 있다. 비-React refresh 실패 경로만
     *    브릿지 `resetSession()`(싱글턴 clear)을 쓴다.
     */
    const resetSession = useCallback(() => {
        resetSessionState()
        queryClient.clear()
    }, [queryClient])

    /*
     * ★ 원자화(spec §3.3): 진입 즉시 이전 계정 상태·캐시를 전량 축출 → 새 토큰 심기 →
     *   새 토큰으로 `GET /me`(계약 §2 로그인 응답엔 사용자 정보가 없다 — 토큰 3종뿐, §2.5 별도 호출) →
     *   `setUser`. 실패 시 반쪽 세션을 남기지 않고 다시 리셋한다. "새 토큰 + 옛 user/옛 캐시" 공존
     *   창을 없앤다 — 로그아웃 없이 계정을 갈아끼워도 이전 신원이 새 요청에 새지 않는다.
     *   비밀번호 로그인·소셜 로그인이 같은 경로를 공유한다.
     */
    const establishSession = useCallback(
        async (tokens: SessionTokens) => {
            resetSession()
            updateTokens(tokens)

            try {
                const me = await getMe()
                setUser({
                    userPublicId: me.userPublicId,
                    nickname: me.nickname,
                    primaryCharacterId: me.primaryCharacterId,
                    isAdmin: me.isAdmin,
                })
            } catch (error) {
                // 프로필 조회가 깨지면 반쪽 세션을 남기지 않는다 — 실패로 되돌린다.
                resetSession()
                throw error
            }
        },
        [resetSession, updateTokens, setUser],
    )

    const signIn = useCallback(
        async (credential: LoginRequest) => {
            await establishSession(await apiLogin(credential))
        },
        [establishSession],
    )

    const oauthSignIn = useCallback(
        async (provider: OAuthProvider, code: string) => {
            // 소셜 응답도 LoginResponse 형상 그대로라 동일 경로로 세션을 확립한다(계약 §2).
            await establishSession(await apiOauthLogin(provider, code))
        },
        [establishSession],
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
            // 서버 호출이 실패해도 로컬 세션·캐시는 반드시 비운다(FC-174 — 전역키 캐시 잔존 차단).
            resetSession()
        }
    }, [resetSession])

    const value = useMemo<AuthContextValue>(
        () => ({
            authenticated: accessToken !== null,
            user,
            signIn,
            oauthSignIn,
            signUp,
            signOut,
        }),
        [accessToken, user, signIn, oauthSignIn, signUp, signOut],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
