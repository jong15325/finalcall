import { apiClient } from '@/lib/api/client';
import type { MeResponse, UpdateNicknameRequest, WithdrawRequest } from '../types';

/**
 * 회원 리소스 함수층 (계약 §2.5). apiClient 위에 얇게 — envelope 언랩·401 회전은 client 담당.
 * getMe 는 auth(로그인 하이드레이션)와 member(프로필 조회) 양쪽이 쓴다(spec §4.4·§6).
 */

/**
 * GET /me — 내 프로필.
 * accessToken 을 넘기면 해당 토큰을 Authorization 에 명시(로그인 직후 하이드레이션 — 스토어 비의존,
 * 중간 인증 상태·가드 플리커 없음. spec §4.4 권고). 미지정 시 client 가 스토어 토큰을 첨부.
 */
export function getMe(accessToken?: string): Promise<MeResponse> {
  return apiClient.get<MeResponse>(
    '/me',
    accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  );
}

/** PATCH /me — 닉네임 수정(조회와 동일 스키마 반환) */
export function updateNickname(body: UpdateNicknameRequest): Promise<MeResponse> {
  return apiClient.patch<MeResponse>('/me', body);
}

/** DELETE /me — 탈퇴(soft delete). 동의 body 전송, 204 */
export function deleteMe(body: WithdrawRequest): Promise<void> {
  return apiClient.delete<void>('/me', body);
}
