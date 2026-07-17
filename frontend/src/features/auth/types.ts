/**
 * auth feature 타입 (계약 §2). 계약 스키마와 1:1 — 임의 필드 금지.
 * password 확인 필드는 클라 일치 검증 전용·서버 미전송(SignupRequest 에 없음).
 */

export interface LoginRequest {
  loginId: string;
  password: string;
}

/** POST /auth/login 응답 — user 요약 없음(하이드레이션은 GET /me, spec §4.4) */
export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
}

export interface SignupRequest {
  loginId: string;
  password: string;
  nickname: string;
}

export interface SignupResponse {
  userPublicId: string;
  nickname: string;
}
