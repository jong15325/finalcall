import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    OAUTH_SESSION_KEY,
    buildAuthorizeUrl,
    generateState,
    isProviderConfigured,
    oauthRedirectUri,
    startOAuth,
    type OAuthPending,
} from './oauth'

/**
 * 소셜 로그인 진입 헬퍼 (FC-155).
 *
 * 고정하는 것:
 *  1. client_id(env) 미설정이면 미설정으로 보고, 이동하지 않는다(방어).
 *  2. 인가 URL 은 response_type=code·client_id·redirect_uri·state 를 담는다.
 *  3. startOAuth 는 state 를 생성·세션 보관하고 인가 페이지로 이동한다(콜백 대조는 FC-156).
 */

const assign = vi.fn()

beforeEach(() => {
    // jsdom 의 location.assign 은 미구현이라 스파이로 대체하고 오리진을 고정한다.
    Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:5173', assign },
        writable: true,
    })
    sessionStorage.clear()
})

afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    assign.mockClear()
})

describe('generateState (암호학적 안전 난수만)', () => {
    it('randomUUID 지원 시 그 값을 쓴다', () => {
        const state = generateState()
        expect(state).not.toBeNull()
        expect((state as string).length).toBeGreaterThan(0)
    })

    it('randomUUID 미지원이면 getRandomValues(16바이트 hex)로 폴백한다', () => {
        // randomUUID 없이 getRandomValues 만 있는 crypto 로 대체.
        vi.stubGlobal('crypto', {
            getRandomValues: (arr: Uint8Array) => {
                for (let i = 0; i < arr.length; i += 1) arr[i] = i + 1
                return arr
            },
        })
        const state = generateState()
        // 16바이트 → 32자리 hex. 결정적 스텁이라 값도 고정된다.
        expect(state).toBe('0102030405060708090a0b0c0d0e0f10')
    })

    it('안전 난수원(crypto)이 없으면 null 을 반환한다(Math.random 미사용)', () => {
        vi.stubGlobal('crypto', undefined)
        expect(generateState()).toBeNull()
    })
})

describe('isProviderConfigured', () => {
    it('client_id 가 없으면 false 다', () => {
        expect(isProviderConfigured('kakao')).toBe(false)
        expect(isProviderConfigured('naver')).toBe(false)
    })

    it('client_id 가 주입되면 true 다', () => {
        vi.stubEnv('VITE_OAUTH_KAKAO_CLIENT_ID', 'kakao-key')
        expect(isProviderConfigured('kakao')).toBe(true)
        expect(isProviderConfigured('naver')).toBe(false)
    })
})

describe('oauthRedirectUri', () => {
    it('env 미설정 시 현재 오리진 기준으로 조립한다', () => {
        expect(oauthRedirectUri()).toBe('http://localhost:5173/oauth/callback')
    })

    it('env 가 있으면 그 값을 쓴다', () => {
        vi.stubEnv(
            'VITE_OAUTH_REDIRECT_URI',
            'https://finalcall.example/oauth/callback',
        )
        expect(oauthRedirectUri()).toBe(
            'https://finalcall.example/oauth/callback',
        )
    })
})

describe('buildAuthorizeUrl', () => {
    it('네이버 인가 URL 에 필수 파라미터를 담는다', () => {
        vi.stubEnv('VITE_OAUTH_NAVER_CLIENT_ID', 'naver-key')
        const url = new URL(buildAuthorizeUrl('naver', 'state-123'))
        expect(url.origin + url.pathname).toBe(
            'https://nid.naver.com/oauth2.0/authorize',
        )
        expect(url.searchParams.get('response_type')).toBe('code')
        expect(url.searchParams.get('client_id')).toBe('naver-key')
        expect(url.searchParams.get('redirect_uri')).toBe(
            'http://localhost:5173/oauth/callback',
        )
        expect(url.searchParams.get('state')).toBe('state-123')
    })

    it('카카오 인가 엔드포인트로 조립한다', () => {
        vi.stubEnv('VITE_OAUTH_KAKAO_CLIENT_ID', 'kakao-key')
        const url = new URL(buildAuthorizeUrl('kakao', 's'))
        expect(url.origin + url.pathname).toBe(
            'https://kauth.kakao.com/oauth/authorize',
        )
    })
})

describe('startOAuth', () => {
    it('미설정이면 경고만 남기고 이동하지 않는다', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        startOAuth('kakao')
        expect(assign).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(OAUTH_SESSION_KEY)).toBeNull()
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })

    it('client_id 는 있으나 안전 난수원(crypto)이 없으면 이동하지 않는다', () => {
        vi.stubEnv('VITE_OAUTH_KAKAO_CLIENT_ID', 'kakao-key')
        vi.stubGlobal('crypto', undefined)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        startOAuth('kakao')
        expect(assign).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(OAUTH_SESSION_KEY)).toBeNull()
        expect(warn).toHaveBeenCalled()
        warn.mockRestore()
    })

    it('설정되면 state 를 세션에 보관하고 인가 페이지로 이동한다', () => {
        vi.stubEnv('VITE_OAUTH_KAKAO_CLIENT_ID', 'kakao-key')
        startOAuth('kakao')

        const stored = sessionStorage.getItem(OAUTH_SESSION_KEY)
        expect(stored).not.toBeNull()
        const pending = JSON.parse(stored as string) as OAuthPending
        expect(pending.provider).toBe('kakao')
        expect(pending.state.length).toBeGreaterThan(0)

        expect(assign).toHaveBeenCalledOnce()
        const target = new URL(assign.mock.calls[0][0] as string)
        // 이동한 URL 의 state 가 세션에 보관한 값과 같다(콜백 대조의 전제).
        expect(target.searchParams.get('state')).toBe(pending.state)
    })
})
