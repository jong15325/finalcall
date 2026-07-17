import { apiClient } from '@/lib/api/client';
import type { LoginRequest, LoginTokens, SignupRequest, SignupResponse } from '../types';

/**
 * 인증 함수층 (계약 §2). login·signup 은 { auth: false } — AUTH_PATHS 라 401 회전 대상 아님(client 처리).
 */

/** POST /auth/login — 토큰 3종 반환(user 는 GET /me 하이드레이션, spec §4.4) */
export function login(body: LoginRequest): Promise<LoginTokens> {
  return apiClient.post<LoginTokens>('/auth/login', body, { auth: false });
}

/** POST /auth/signup — 201 { userPublicId, nickname }. 토큰 없음(자동 로그인 안 함, P-010) */
export function signup(body: SignupRequest): Promise<SignupResponse> {
  return apiClient.post<SignupResponse>('/auth/signup', body, { auth: false });
}

/** POST /auth/logout — refresh 무효화, 204 */
export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}
