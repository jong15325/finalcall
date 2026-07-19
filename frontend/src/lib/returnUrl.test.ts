import { describe, it, expect } from 'vitest'
import {
    sanitizeReturnUrl,
    buildReturnUrlQuery,
    DEFAULT_RETURN_URL,
} from './returnUrl'

/**
 * 복귀 URL 규칙 고정 (FC-057 — 구 프론트 P-011 복원).
 * 여기서 막는 것은 UX 가 아니라 **오픈 리다이렉트**다.
 */
describe('sanitizeReturnUrl — 오픈 리다이렉트 차단', () => {
    it('앱 내부 절대경로는 그대로 통과한다', () => {
        expect(sanitizeReturnUrl('/sell')).toBe('/sell')
        expect(sanitizeReturnUrl('/me/inventory')).toBe('/me/inventory')
    })

    it('query·hash 를 보존한다 — 보던 필터로 돌아가야 한다', () => {
        expect(sanitizeReturnUrl('/auctions?status=OPEN&sort=endsAt')).toBe(
            '/auctions?status=OPEN&sort=endsAt',
        )
        expect(sanitizeReturnUrl('/auctions#top')).toBe('/auctions#top')
    })

    it('외부 절대 URL 을 거부한다', () => {
        expect(sanitizeReturnUrl('http://evil.example')).toBe(
            DEFAULT_RETURN_URL,
        )
        expect(sanitizeReturnUrl('https://evil.example/login')).toBe(
            DEFAULT_RETURN_URL,
        )
    })

    it('프로토콜 상대 URL(`//host`) 을 거부한다 — 이것도 외부로 나간다', () => {
        expect(sanitizeReturnUrl('//evil.example')).toBe(DEFAULT_RETURN_URL)
    })

    it('백슬래시 우회(`/\\host`) 를 거부한다', () => {
        expect(sanitizeReturnUrl('/\\evil.example')).toBe(DEFAULT_RETURN_URL)
    })

    it('상대경로·빈값·null 은 홈으로 떨어진다', () => {
        expect(sanitizeReturnUrl('sell')).toBe(DEFAULT_RETURN_URL)
        expect(sanitizeReturnUrl('')).toBe(DEFAULT_RETURN_URL)
        expect(sanitizeReturnUrl(null)).toBe(DEFAULT_RETURN_URL)
        expect(sanitizeReturnUrl(undefined)).toBe(DEFAULT_RETURN_URL)
    })
})

describe('buildReturnUrlQuery', () => {
    it('경로에 query·hash 를 함께 싣고 인코딩한다', () => {
        const query = buildReturnUrlQuery({
            pathname: '/auctions',
            search: '?status=OPEN',
            hash: '#top',
        })
        expect(query).toBe(
            `?redirectUrl=${encodeURIComponent('/auctions?status=OPEN#top')}`,
        )
    })

    it('인코딩 결과가 다시 원본으로 복원된다(왕복)', () => {
        const target = '/auctions?status=OPEN&sort=endsAt'
        const query = buildReturnUrlQuery({ pathname: target })
        const decoded = new URLSearchParams(query).get('redirectUrl')
        expect(sanitizeReturnUrl(decoded)).toBe(target)
    })

    it('홈에서는 복귀 파라미터를 만들지 않는다 — 기본값과 같아 무의미하다', () => {
        expect(buildReturnUrlQuery({ pathname: '/' })).toBe('')
    })
})
