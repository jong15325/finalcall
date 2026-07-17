import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKey } from '@/lib/api/queryKeys';
import { useAuthStore, useIsAuthenticated } from '@/stores/authStore';
import { deleteMe, getMe, updateNickname } from './memberApi';
import type { MeResponse } from '../types';

/** 쿼리 키 — 국소 생성(중앙 레지스트리 안 만듦, spec §4.3). */
export const memberKeys = {
  me: () => queryKey('member', 'me'),
};

/** GET /me — 프로필 조회(인증 시에만). */
export function useMe() {
  const isAuthed = useIsAuthenticated();
  return useQuery({
    queryKey: memberKeys.me(),
    queryFn: () => getMe(),
    enabled: isAuthed,
  });
}

/** PATCH /me — 닉네임 수정. 성공 시 캐시 갱신 + 헤더 닉네임 동기화(authStore.updateUser). */
export function useUpdateNickname() {
  const qc = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (nickname: string) => updateNickname({ nickname }),
    onSuccess: (me: MeResponse) => {
      qc.setQueryData(memberKeys.me(), me);
      updateUser({ nickname: me.nickname });
    },
  });
}

/** DELETE /me — 탈퇴. 성공 시 세션 정리 + 캐시 전량 폐기(다음 사용자 오염 방지). */
export function useWithdraw() {
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: () => deleteMe({ balanceForfeitAcknowledged: true }),
    onSuccess: () => {
      clearSession();
      qc.clear();
    },
  });
}
