import { describe, expect, it } from 'vitest'
import { auctionListStatusOf } from './auctionListState'

/**
 * 경매 목록 상태 분기 (FC-071).
 *
 * 고정하는 것: **데이터 있음 > 로딩 > 오류 > 빈결과**. 특히 스크롤 중 배경 재조회 실패가
 * 화면 전체를 오류로 치환하지 않는다(가진 카드를 지우지 않는다).
 */

describe('auctionListStatusOf', () => {
    it('카드가 있으면 ready — 배경 오류에도 목록을 지우지 않는다', () => {
        expect(
            auctionListStatusOf({
                isPending: false,
                isError: true,
                itemCount: 10,
            }),
        ).toBe('ready')
    })

    it('첫 데이터 없이 대기 중이면 loading', () => {
        expect(
            auctionListStatusOf({
                isPending: true,
                isError: false,
                itemCount: 0,
            }),
        ).toBe('loading')
    })

    it('첫 데이터 없이 실패면 error', () => {
        expect(
            auctionListStatusOf({
                isPending: false,
                isError: true,
                itemCount: 0,
            }),
        ).toBe('error')
    })

    it('성공했으나 0건이면 empty (성립 불가 조합도 여기로 — 오류 아님)', () => {
        expect(
            auctionListStatusOf({
                isPending: false,
                isError: false,
                itemCount: 0,
            }),
        ).toBe('empty')
    })
})
