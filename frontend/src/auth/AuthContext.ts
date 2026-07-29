import { createContext } from 'react'
import type { LoginRequest, SignupRequest } from '@/lib/api/auth'
import type { OAuthProvider } from '@/features/auth/lib/oauth'
import type { UserSummary } from '@/store/authStore'

/**
 * 인증 컨텍스트 (FC-056 — 템플릿 원본을 계약 §2 기준으로 재작성).
 *
 * ★ 템플릿은 실패를 `{ status, message }` **문자열**로 뭉갰다. 우리는 `ApiError` 를 그대로
 *   throw 한다 — 화면이 `code` 로 분기해야 하기 때문이다. 로그인 실패(`AUTH_003`)는 폼 배너
 *   하나로, 가입 실패(`AUTH_001`·`AUTH_002`)는 필드 단위로 다루는 등 대응이 코드마다 다르다
 *   (SEC-007). 메시지 문자열로 좁히면 그 분기가 불가능해진다.
 */
export interface AuthContextValue {
    /** 세션 보유 여부(액세스 토큰 존재). 인가가 아니라 표시·라우팅 가드용이다(계약 §1.2). */
    authenticated: boolean
    user: UserSummary | null
    /** 성공 시 세션 확립. 실패 시 `ApiError` throw — 화면이 `code` 로 분기한다. */
    signIn: (credential: LoginRequest) => Promise<void>
    /**
     * 소셜 로그인·가입(통합) — provider 콜백의 `code` 를 교환해 세션을 확립한다(FC-156).
     * `signIn` 과 **동일한 토큰 저장·프로필 조회 경로**를 공유한다(계약 §2 — LoginResponse 형상 재사용).
     * 실패 시 `ApiError` throw — 콜백 화면이 `code`(AUTH_006/007/008) 로 분기한다.
     */
    oauthSignIn: (provider: OAuthProvider, code: string) => Promise<void>
    /** 가입만 한다. **계약 §2 상 가입 응답에 토큰이 없다** — 자동 로그인하지 않는다. */
    signUp: (credential: SignupRequest) => Promise<void>
    /** 서버 세션 폐기 + 로컬 정리. 서버 호출이 실패해도 로컬은 반드시 비운다. */
    signOut: () => Promise<void>
}

const notReady = (): never => {
    throw new Error('AuthProvider 밖에서 인증 액션을 호출했습니다.')
}

const AuthContext = createContext<AuthContextValue>({
    authenticated: false,
    user: null,
    signIn: notReady,
    oauthSignIn: notReady,
    signUp: notReady,
    signOut: notReady,
})

export default AuthContext
