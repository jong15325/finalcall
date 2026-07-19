import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import cookiesStorage from '@/utils/cookiesStorage'
import appConfig from '@/configs/app.config'
import { ADMIN, USER } from '@/constants/roles.constant'

/**
 * 인증 세션 스토어 (FC-056 — 템플릿 `useSessionUser`/`useToken` 을 대체한다).
 *
 * ★ 템플릿 원본은 **토큰과 사용자를 서로 다른 저장소에** 넣었다 — 토큰은
 *   `accessTokenPersistStrategy`(쿠키/스토리지), 사용자는 항상 localStorage. 둘이 갈라지면
 *   "토큰은 없는데 signedIn 은 true" 같은 반쪽 세션이 남는다. 여기서는 **한 덩어리로 저장**해
 *   원자적으로 세우고 원자적으로 지운다.
 *
 * ★ 서버 데이터(잔액·프로필 상세 등)는 이 스토어에 복제하지 않는다 — react-query 소관.
 *   `user` 요약은 인증 세션의 일부(표시·가드용)로만 보관한다.
 */

/**
 * 세션 사용자 요약 (계약 §2.5 `GET /me` 파생 — 표시/가드용).
 * `isAdmin` 은 관리자 UI 노출 제어일 뿐 **인가가 아니다**(계약 §1.2 — 인가는 서버 권위).
 */
export interface UserSummary {
    userPublicId: string
    nickname: string
    isAdmin: boolean
}

/** 토큰 3종 (계약 §2 login·refresh 응답 — 두 응답 스키마가 동일하다) */
export interface SessionTokens {
    accessToken: string
    refreshToken: string
    accessExpiresAt: string
}

export interface AuthSession extends SessionTokens {
    user: UserSummary
}

interface AuthState {
    accessToken: string | null
    refreshToken: string | null
    accessExpiresAt: string | null
    user: UserSummary | null

    /** 로그인·세션 확립 */
    setSession: (session: AuthSession) => void
    /** refresh 회전 — 신규 토큰만 갱신(user 유지, 계약 §2 회전 정책) */
    updateTokens: (tokens: SessionTokens) => void
    /**
     * user 요약 설정. 로그인 직후 `GET /me`(계약 §2.5) 결과를 심는 자리다 —
     * 계약 §2 로그인 응답에는 사용자 정보가 없어 토큰과 프로필이 2단계로 들어온다.
     */
    setUser: (user: UserSummary) => void
    /** user 요약 부분 갱신(닉네임 수정 반영 등). 세션 없으면 무시. */
    updateUser: (partial: Partial<UserSummary>) => void
    /** 로그아웃·세션 만료 — 전체 정리 */
    clearSession: () => void
}

const SESSION_STORAGE_KEY = 'finalcall.session'

/**
 * 세션 저장소 선택 (`appConfig.accessTokenPersistStrategy`).
 *
 * ★★ **이 전략값은 FC-056 시점에 미확정이다(게이트2 상신).** 그래서 저장 위치를 코드에 박지 않고
 *    설정 한 줄로 갈아끼우도록 뒀다 — 판정이 무엇으로 나든 이 파일은 바뀌지 않는다.
 *    현행 백엔드는 토큰을 **응답 바디로** 주고 `/auth/refresh`·`/auth/logout` 이 refreshToken 을
 *    **요청 바디로** 요구하므로, 어떤 전략을 택하든 JS 가 토큰을 읽을 수 있어야 한다
 *    (= httpOnly 쿠키는 백엔드 무변경으로 불가능하다). 상세 분석은 FC-056 반환 참조.
 */
const getPersistStorage = () => {
    switch (appConfig.accessTokenPersistStrategy) {
        case 'sessionStorage':
            return sessionStorage
        case 'cookies':
            return cookiesStorage
        default:
            return localStorage
    }
}

const emptySession = {
    accessToken: null,
    refreshToken: null,
    accessExpiresAt: null,
    user: null,
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            ...emptySession,

            setSession: (session) =>
                set({
                    accessToken: session.accessToken,
                    refreshToken: session.refreshToken,
                    accessExpiresAt: session.accessExpiresAt,
                    user: session.user,
                }),

            updateTokens: (tokens) =>
                set({
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    accessExpiresAt: tokens.accessExpiresAt,
                }),

            setUser: (user) => set({ user }),

            updateUser: (partial) =>
                set((state) =>
                    // 세션이 없으면 무시한다 — 유령 사용자를 만들지 않는다.
                    state.user ? { user: { ...state.user, ...partial } } : {},
                ),

            clearSession: () => set({ ...emptySession }),
        }),
        {
            name: SESSION_STORAGE_KEY,
            storage: createJSONStorage(getPersistStorage),
            // 액션은 저장하지 않는다(직렬화 대상은 상태뿐).
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                accessExpiresAt: state.accessExpiresAt,
                user: state.user,
            }),
        },
    ),
)

/** 인증 여부 셀렉터 (파생 — 별도 boolean state 를 복제하면 토큰과 어긋난다) */
export const selectIsAuthenticated = (state: AuthState): boolean =>
    state.accessToken !== null

/** 컴포넌트용 인증 여부 훅 */
export const useIsAuthenticated = (): boolean =>
    useAuthStore(selectIsAuthenticated)

/** 관리자 표시 여부 (UI 노출 제어 전용 — 인가는 서버, 계약 §1.2) */
export const useIsAdmin = (): boolean =>
    useAuthStore((state) => state.user?.isAdmin === true)

/**
 * 템플릿 권한 배열로의 어댑터 (`AuthorityGuard`·내비 필터가 문자열 배열을 요구한다).
 *
 * ★ 역할 모델을 두 벌 두지 않으려고 **파생**으로만 만든다. 계약이 주는 것은 `isAdmin`
 *   불리언 하나뿐이고(§2.5), 이 배열은 그것의 표현일 뿐이다. 스토어에 `authority` 를 따로
 *   저장하면 `isAdmin` 과 어긋날 자리가 생긴다.
 * ★ 이것은 **표시 제어**다. 실제 인가는 서버가 판정한다(계약 §1.2).
 */
/*
 * 모듈 상수로 고정한다 — 셀렉터가 매 호출 새 배열을 만들면 zustand v5 의 스냅샷 비교가 항상
 * 불일치해 무한 리렌더가 난다.
 */
const NO_AUTHORITY: string[] = []
const USER_AUTHORITY: string[] = [USER]
const ADMIN_AUTHORITY: string[] = [USER, ADMIN]

export const useUserAuthority = (): string[] =>
    useAuthStore((state) => {
        if (!state.user) return NO_AUTHORITY
        return state.user.isAdmin ? ADMIN_AUTHORITY : USER_AUTHORITY
    })
