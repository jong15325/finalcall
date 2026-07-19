import { describe, it, expect } from 'vitest'
import {
    protectedRoutes,
    publicRoutes,
    sharedRoutes,
} from './routes.config'
import { ROUTES } from './paths'

/**
 * 라우팅 골격 회귀 (FC-055).
 *
 * ★ 이 티켓은 화면을 만들지 않으므로 테스트도 **골격만** 건다. 종전 126건이 고정하던 규칙
 *   (SEC-007 · 코드 폴백 · 아트 레벨 축 등)은 해당 코드가 이식되는 FC-056 이후에 되살아난다.
 *   여기서는 러너가 서는 것과 **경로 버킷 분류**를 지킨다.
 */
describe('라우팅 골격 — 버킷 분류', () => {
    const pathsOf = (routes: typeof sharedRoutes) => routes.map((r) => r.path)

    it('공개 커머스의 본체는 가드 없는 shared 버킷에 있다', () => {
        // 로그인 여부로 갈리면 안 되는 경로들. 하나라도 protected 로 새면
        // 검색·공유로 들어온 비로그인 손님이 로그인 화면으로 튕긴다.
        expect(pathsOf(sharedRoutes)).toEqual(
            expect.arrayContaining([
                ROUTES.home,
                ROUTES.auctions,
                ROUTES.auctionDetail,
                ROUTES.shops,
                ROUTES.itemDetail,
                ROUTES.marketPrices,
            ]),
        )
    })

    it('인증 폼만 비로그인 전용이다 — 로그인 사용자는 되돌아간다', () => {
        expect(pathsOf(publicRoutes)).toEqual([ROUTES.login, ROUTES.signup])
    })

    it('me 주체·관리자 경로는 보호된다', () => {
        expect(pathsOf(protectedRoutes)).toEqual(
            expect.arrayContaining([
                ROUTES.inventory,
                ROUTES.tempStorage,
                ROUTES.orders,
                ROUTES.wallet,
                ROUTES.profile,
                ROUTES.adminAuctionDetail,
            ]),
        )
    })

    it('같은 경로가 두 버킷에 동시에 있지 않다(가드가 갈린다)', () => {
        const all = [
            ...pathsOf(sharedRoutes),
            ...pathsOf(publicRoutes),
            ...pathsOf(protectedRoutes),
        ]
        expect(new Set(all).size).toBe(all.length)
    })

    it('경로는 전부 계약이 정한 ROUTES 값에서 온다 — 템플릿 기본값이 새지 않는다', () => {
        const known = new Set<string>(Object.values(ROUTES))
        const strays = [...sharedRoutes, ...publicRoutes]
            .map((r) => r.path)
            .filter((p) => !known.has(p))
        // `/sign-in` 같은 템플릿 잔재가 남으면 여기서 잡힌다.
        expect(strays).toEqual([])
    })
})
