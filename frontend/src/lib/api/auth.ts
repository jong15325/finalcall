import { apiClient } from './client'
import { oauthRedirectUri } from '@/features/auth/lib/oauth'
import type { OAuthProvider } from '@/features/auth/lib/oauth'
import type { SessionTokens, UserSummary } from '@/store/authStore'

/**
 * 인증·회원 엔드포인트 (계약 §2·§2.5) — FC-056.
 *
 * ★ 계약에 있는 것만 둔다. 템플릿 `AuthService` 의 `forgotPassword`·`resetPassword` 는
 *   **우리 계약에 엔드포인트가 없어** 옮기지 않았다(화면만 있고 뒤가 없는 경로를 만들지 않는다).
 */

/** `POST /auth/signup` 요청 (계약 §2) */
export interface SignupRequest {
    loginId: string
    password: string
    nickname: string
    /**
     * 이메일 — **선택**(계약 §2·email-verify-spec §4.1). 값이 있으면 `@Email`·≤255 로 전송하고,
     * 없으면 **키 자체를 생략**한다(null·빈문자 전송 아님 → 이메일 없는 계정 생성). 생략을 보장하는
     * 주체는 제출 폼(`SignupForm`)이다 — 빈 값이면 이 키를 payload 에 넣지 않는다. 인증은 가입
     * 응답(201, email 미노출) 이후 별도 화면(F2)에서 처리한다.
     */
    email?: string
}

/** `POST /auth/signup` 응답 201 — **토큰을 주지 않는다.** 가입 후 로그인은 별도 호출이다. */
export interface SignupResponse {
    userPublicId: string
    nickname: string
}

/** `POST /auth/login` 요청 (계약 §2) */
export interface LoginRequest {
    loginId: string
    password: string
}

/** 프로필 (계약 §2.5 `GET`/`PATCH /me` 공통 응답) */
export interface MeResponse extends UserSummary {
    createdAt: string
    /**
     * 이메일 인증 완료 여부(계약 §2.5 v1.15). `emailMasked` 와 조합해 3상태를 가른다 —
     * `emailMasked=null`→미설정 / non-null & `emailVerified=false`→설정·미인증 / `true`→인증완료.
     */
    emailVerified: boolean
    /**
     * 마스킹 이메일(예 `a***@naver.com`) 또는 `null`(미설정). **원문은 싣지 않는다**(마스킹만,
     * 계약 §2.5). 이메일 설정 직후 에코(원문)는 `PUT /me/email` 응답에서만 온다.
     */
    emailMasked: string | null
}

/**
 * 회원가입 — 실패: `AUTH_001`(중복 loginId, 409)·`AUTH_002`(중복 nickname, 409)·
 * `EMAIL_007`(중복 email, 409 — email 제공 시 유니크 위반)·400 검증.
 */
export function signup(body: SignupRequest): Promise<SignupResponse> {
    return apiClient.post<SignupResponse>('/auth/signup', body, { auth: false })
}

/**
 * 로그인 — 응답 `{ accessToken, refreshToken, accessExpiresAt }`.
 * 실패는 **단일 코드 `AUTH_003`(401)** 이다 — 아이디/비밀번호 중 무엇이 틀렸는지 서버가 구분해
 * 주지 않는다(회원 열거 방지 SEC-007). 화면도 이를 필드 단위로 되살리면 안 된다.
 */
export function login(body: LoginRequest): Promise<SessionTokens> {
    return apiClient.post<SessionTokens>('/auth/login', body, { auth: false })
}

/**
 * 소셜 로그인·가입(통합) — `POST /auth/oauth/{provider}` (계약 §2 소셜 로그인 방식 B).
 *
 * ★ 응답은 **기존 `LoginResponse` 형상 그대로**(`{ accessToken, refreshToken, accessExpiresAt }`)라
 *   비밀번호 로그인과 토큰 저장 경로를 공유한다(가입·로그인 모두 200 — find-or-create, SEC-007).
 * ★ `redirectUri` 는 FC-155 인가 요청이 쓴 값과 **동일**해야 한다(provider 토큰 교환의 일치 요건)
 *   → `oauthRedirectUri()` 단일 출처를 재사용한다(`VITE_OAUTH_REDIRECT_URI`).
 * ★ `state`(CSRF)는 요청 바디에 두지 않는다 — 프론트 소유이며 콜백에서 대조한다(계약 §2 확정).
 *   실패: `AUTH_006`(미지원 provider·400)·`AUTH_007`(코드 교환 실패·401)·`AUTH_008`(provider 통신·502).
 */
export function oauthLogin(
    provider: OAuthProvider,
    code: string,
): Promise<SessionTokens> {
    return apiClient.post<SessionTokens>(
        `/auth/oauth/${provider}`,
        { code, redirectUri: oauthRedirectUri() },
        { auth: false },
    )
}

/**
 * 토큰 재발급 — 회전된 신규 refreshToken 을 함께 받는다(계약 §2 v1.1).
 *
 * ★ 일반 요청의 401 자동 회전은 `apiClient` 내부 single-flight 가 처리한다. 이 함수를 직접
 *   부르는 경로를 늘리지 마라 — 병렬 호출이 곧 재사용 탐지(세션 무효화)다.
 */
export function refresh(refreshToken: string): Promise<SessionTokens> {
    return apiClient.post<SessionTokens>(
        '/auth/refresh',
        { refreshToken },
        { auth: false },
    )
}

/**
 * 로그아웃 — 응답 204.
 *
 * ★ **현행 백엔드는 요청 바디로 `{ refreshToken }` 을 요구한다**(`LogoutRequest`, `@NotBlank`).
 *   계약 §2 본문에는 "인증 필요 / refreshToken 무효화 / 204" 로만 적혀 있어 요청 바디 명세가
 *   비어 있다 — 구현이 계약보다 구체적인 지점이다(FC-056 발견, 문서 수정은 범위 밖).
 *   누락하면 400 이다.
 */
export function logout(refreshToken: string): Promise<void> {
    return apiClient.post<void>('/auth/logout', { refreshToken })
}

/** 내 프로필 조회 (계약 §2.5) — 401 은 미인증·만료·**탈퇴 주체**(COMMON_005) 공통이다. */
export function getMe(): Promise<MeResponse> {
    return apiClient.get<MeResponse>('/me')
}

/** 프로필 수정 — nickname 한정 (계약 §2.5). 실패: `MEMBER_001`(중복, 409) */
export function updateMe(nickname: string): Promise<MeResponse> {
    return apiClient.patch<MeResponse>('/me', { nickname })
}

/**
 * 탈퇴(soft delete) — 응답 204 (계약 §2.5).
 * `balanceForfeitAcknowledged` 는 잔액이 0이어도 **필수**다(D-080 — 명시 동의·감사 추적).
 * 실패: `MEMBER_002`(진행 중 거래 보유, 409)·400(동의 누락)
 */
export function withdraw(): Promise<void> {
    return apiClient.delete<void>('/me', { balanceForfeitAcknowledged: true })
}
