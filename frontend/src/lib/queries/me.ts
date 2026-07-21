import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, updateMe, withdraw } from '@/lib/api/auth'
import { useAuthStore, useIsAuthenticated } from '@/store/authStore'
import type { MeResponse } from '@/lib/api/auth'

/**
 * 내 프로필 쿼리·변이 (계약 §2.5 `GET/PATCH/DELETE /me`) — FC-074.
 *
 * ★ **세션 스토어(`authStore`)와의 역할 분담**: 스토어의 `user` 요약(userPublicId·nickname·
 *   isAdmin)은 **표시·가드용 캐시**이고, 이 쿼리는 계약 §2.5 프로필 전체(**+ createdAt**)의
 *   정본이다. createdAt 은 로그인 응답에 없어(§2 토큰 3종뿐) 오직 여기서만 온다.
 * ★ 닉네임 수정 성공 시 **쿼리 캐시와 세션 스토어를 함께 갱신**한다 — 헤더·가드가 스토어의
 *   `user.nickname` 을 보므로 한쪽만 고치면 화면이 어긋난다.
 */
export const meKeys = {
    all: ['me'] as const,
    profile: () => [...meKeys.all, 'profile'] as const,
}

/**
 * 내 프로필.
 *
 * ★ `enabled: isAuthed` — /me 화면은 ProtectedRoute 뒤라 항상 인증 상태지만, 비인증에서
 *   호출이 새면 401→refresh 회전이 헛돌므로(`useMyBalance` 와 같은 이유) 가드를 둔다.
 */
export function useMe() {
    const isAuthed = useIsAuthenticated()

    return useQuery<MeResponse>({
        queryKey: meKeys.profile(),
        queryFn: getMe,
        enabled: isAuthed,
    })
}

/**
 * 닉네임 수정 (`PATCH /me`) — 실패 `MEMBER_001`(중복, 409)·400(검증).
 *
 * ★ 성공 시 프로필 캐시를 응답으로 교체하고 세션 스토어의 `user.nickname` 도 갱신한다
 *   (`getState().updateUser` — 구독 없이 1회 갱신). 서버 원문 에러는 호출부가 `error` 로 받아
 *   code 로 문구를 낸다(`memberErrors.ts`).
 */
export function useUpdateNickname() {
    const queryClient = useQueryClient()

    return useMutation<MeResponse, Error, string>({
        mutationFn: (nickname) => updateMe(nickname),
        onSuccess: (me) => {
            queryClient.setQueryData(meKeys.profile(), me)
            useAuthStore.getState().updateUser({ nickname: me.nickname })
        },
    })
}

/**
 * 회원 탈퇴 (`DELETE /me`, 204) — 실패 `MEMBER_002`(진행 중 거래, 409).
 *
 * ★ `withdraw()` 가 `balanceForfeitAcknowledged: true` 를 **항상** 실어 보낸다(D-080 — 명시
 *   동의·감사 추적). UI 는 별도로 사용자 동의 체크를 강제하지만, 계약 필수 필드는 api 층이 보장한다.
 * ★ 탈퇴는 서버가 refresh 세션을 전부 폐기한다(복구 불가). **로컬 세션 정리·라우팅은 호출부**가
 *   onSuccess 에서 처리한다(여기서 clearSession 하면 ProtectedRoute 리다이렉트와 경합).
 */
export function useWithdraw() {
    return useMutation<void, Error, void>({
        mutationFn: () => withdraw(),
    })
}
