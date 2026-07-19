import { describe, expect, it } from 'vitest'
import { useAuthStore } from '@/store/authStore'

/**
 * 테스트 셋업의 스토어 초기화 검증 (FC-056 복원).
 *
 * ★★ **순서 의존을 고정으로 잡는다.** zustand 스토어는 모듈 싱글턴이라 한 테스트가 심은 세션이
 *    다음 테스트로 샌다. 그러면 "이 파일만 돌리면 통과, 전체를 돌리면 실패"(또는 그 반대로
 *    **거짓 통과**)하는 상태가 되는데, 실패 원인이 자기 파일 안에 없어 추적이 유난히 어렵다.
 *    아래 두 테스트는 **순서대로 읽어야 의미가 있다** — 앞이 더럽히고 뒤가 깨끗함을 요구한다.
 */
describe('테스트 간 인증 스토어 격리', () => {
    it('(1) 세션을 심는다 — 다음 테스트를 오염시키려는 시도다', () => {
        useAuthStore.getState().setSession({
            accessToken: 'leaked-access',
            refreshToken: 'leaked-refresh',
            accessExpiresAt: '2026-07-19T01:00:00Z',
            user: {
                userPublicId: 'U-LEAK',
                nickname: '누수',
                isAdmin: true,
            },
        })

        expect(useAuthStore.getState().accessToken).toBe('leaked-access')
    })

    it('(2) 앞 테스트의 세션이 남아 있지 않다 (setup 의 afterEach 가 지운다)', () => {
        const state = useAuthStore.getState()

        expect(state.accessToken).toBeNull()
        expect(state.refreshToken).toBeNull()
        expect(state.accessExpiresAt).toBeNull()
        expect(state.user).toBeNull()
    })

    it('(3) persist 저장소에도 앞 테스트의 토큰이 남지 않는다', () => {
        // 스토어만 비우고 저장소를 놔두면 다음 테스트가 hydrate 로 되살아난다.
        const persisted = localStorage.getItem('finalcall.session') ?? ''

        expect(persisted).not.toContain('leaked-access')
        expect(persisted).not.toContain('leaked-refresh')
    })
})
