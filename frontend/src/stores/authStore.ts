import { create } from 'zustand';

/**
 * 인증 세션 스토어 (Zustand 최소, 진짜 전역만 — 프론트 CLAUDE.md [4]).
 *
 * persist 없음 = 메모리 세션. 새로고침 시 재로그인이 정상이다(skeleton-plan [6]#5 보안 사안:
 * refresh 토큰을 브라우저 저장소에 두면 XSS 노출면 발생, 자금 시스템이라 가장 보수적 선택).
 * persist 완화는 wallet 도메인 착수 전 보안(S) 검토로 확정한다.
 *
 * 서버 데이터(잔액·프로필 등)는 이 스토어에 복제하지 않는다 — TanStack Query 소관.
 * user 요약은 인증 세션의 일부(표시·가드용)로만 보관한다.
 */

/** 세션 사용자 요약 (GET /me·login 파생 — 표시/가드용). isAdmin은 UI 노출 제어일 뿐 인가 아님(계약 [1.2]). */
export interface UserSummary {
  userPublicId: string;
  nickname: string;
  isAdmin: boolean;
}

/** 토큰 3종 (계약 [2] login·refresh 응답) */
export interface SessionTokens {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
}

export interface AuthSession extends SessionTokens {
  user: UserSummary;
}

interface AuthState {
  accessToken: string | null;
  accessExpiresAt: string | null;
  refreshToken: string | null;
  user: UserSummary | null;

  /** 로그인·세션 확립 */
  setSession: (session: AuthSession) => void;
  /** refresh 회전 — 신규 토큰만 갱신(user 유지, 계약 [2] 회전 정책) */
  updateTokens: (tokens: SessionTokens) => void;
  /** user 요약 부분 갱신(닉네임 수정 반영 — 헤더 동기화). 세션 없으면 무시. */
  updateUser: (partial: Partial<UserSummary>) => void;
  /** 로그아웃·세션 만료 — 전체 정리 */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessExpiresAt: null,
  refreshToken: null,
  user: null,

  setSession: (session) =>
    set({
      accessToken: session.accessToken,
      accessExpiresAt: session.accessExpiresAt,
      refreshToken: session.refreshToken,
      user: session.user,
    }),

  updateTokens: (tokens) =>
    set({
      accessToken: tokens.accessToken,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshToken: tokens.refreshToken,
    }),

  updateUser: (partial) =>
    set((state) => (state.user ? { user: { ...state.user, ...partial } } : {})),

  clearSession: () =>
    set({
      accessToken: null,
      accessExpiresAt: null,
      refreshToken: null,
      user: null,
    }),
}));

/** 인증 여부 셀렉터 (파생 — 별도 boolean state 복제 금지) */
export const selectIsAuthenticated = (state: AuthState): boolean => state.accessToken !== null;

/** 컴포넌트용 인증 여부 훅 */
export const useIsAuthenticated = (): boolean => useAuthStore(selectIsAuthenticated);
