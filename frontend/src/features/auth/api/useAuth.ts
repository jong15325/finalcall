import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getMe } from '@/features/member/api/memberApi';
import { memberKeys } from '@/features/member/api/useMember';
import { useAuthStore } from '@/stores/authStore';
import { login, logout, signup } from './authApi';
import type { LoginRequest, SignupRequest } from '../types';

/**
 * 로그인 — POST /auth/login → GET /me 하이드레이션 → setSession (spec §4.4).
 * 계약 login 응답에 user 요약이 없어 헤더 닉네임·admin 가드를 위해 GET /me 로 채운다.
 * 하이드레이션은 명시 토큰 호출(스토어 비의존)이라 중간 인증 상태·가드 플리커가 없다.
 */
export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: LoginRequest) => {
      const tokens = await login(body);
      const me = await getMe(tokens.accessToken);
      setSession({
        accessToken: tokens.accessToken,
        accessExpiresAt: tokens.accessExpiresAt,
        refreshToken: tokens.refreshToken,
        user: { userPublicId: me.userPublicId, nickname: me.nickname, isAdmin: me.isAdmin },
      });
      // GET /me 재요청 절약 — 마이페이지 진입 시 캐시 재사용
      qc.setQueryData(memberKeys.me(), me);
      return me;
    },
  });
}

/** 회원가입 — POST /auth/signup. 성공 후 /login 이동은 호출부에서(자동 로그인 없음, P-010). */
export function useSignup() {
  return useMutation({
    mutationFn: (body: SignupRequest) => signup(body),
  });
}

/** 로그아웃 — POST /auth/logout → 결과 무관 세션·캐시 정리(클라 측 항상 로그아웃). */
export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      clearSession();
      qc.clear();
    },
  });
}
