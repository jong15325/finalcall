import { describe, expect, it } from 'vitest'
import { computeSellerFee } from './sellerFee'

/**
 * 판매자 수수료 예상 계산 (fee-policy-spec v1.0) — FC-073.
 *
 * 이 파일이 고정하는 것 = **fee-policy-spec 의 워크드 예시·경계표를 그대로 검산**한다. 값이
 * 어긋나면 프론트 예상치가 서버 정산과 벌어진다(사용자 신뢰 훼손). 정책 문서(§4)가 정본이다.
 */
describe('computeSellerFee — fee-policy-spec §4 검산', () => {
    it('대표 예시 P=2,480,000 → fee 110,200 · settle 2,369,800 (§4.1)', () => {
        expect(computeSellerFee(2_480_000)).toEqual({
            fee: 110_200,
            settle: 2_369_800,
        })
    })

    it('구간별 누진(marginal) — 각 경계값 (§4.2)', () => {
        // 최소(6% < 100) → 100 floor.
        expect(computeSellerFee(1_000).fee).toBe(100)
        // 1구간 상단.
        expect(computeSellerFee(100_000).fee).toBe(6_000)
        // 2구간 상단: 6,000 + 45,000.
        expect(computeSellerFee(1_000_000).fee).toBe(51_000)
        // 3구간 상단: 6,000 + 45,000 + 80,000.
        expect(computeSellerFee(3_000_000).fee).toBe(131_000)
    })

    it('상한(cap) 300,000 — 대형 판매가는 고정된다 (§4.2)', () => {
        // 131,000 + 0.03 × 17,000,000 = 641,000 → cap 300,000.
        expect(computeSellerFee(20_000_000).fee).toBe(300_000)
        expect(computeSellerFee(20_000_000).settle).toBe(20_000_000 - 300_000)
    })

    it('cap 바인딩 지점 ≈ 8,633,333 근처는 300,000 (§4.2)', () => {
        // 131,000 + 0.03 × 5,633,333 ≈ 300,000.00 → 반올림 후 cap.
        expect(computeSellerFee(8_633_333).fee).toBe(300_000)
    })

    it('최소(100) 바인딩 — 1,666 이하는 100 (§4.2)', () => {
        expect(computeSellerFee(1_666).fee).toBe(100)
        expect(computeSellerFee(1_667).fee).toBe(100)
    })

    it('판매가 0 이면 수수료 0 (등록 화면 초기 상태)', () => {
        expect(computeSellerFee(0)).toEqual({ fee: 0, settle: 0 })
    })

    it('극소액은 최소 수수료 적용 뒤 판매가로 clamp해 정산액을 음수로 만들지 않는다', () => {
        expect(computeSellerFee(1)).toEqual({ fee: 1, settle: 0 })
        expect(computeSellerFee(99)).toEqual({ fee: 99, settle: 0 })
        expect(computeSellerFee(100)).toEqual({ fee: 100, settle: 0 })
    })

    it('원단위 사사오입은 누진 합계 직후 1회 — 소수 부분을 반올림한다', () => {
        // 0.06 × 1,666 = 99.96 → round 100 → max(100,100) = 100.
        expect(computeSellerFee(1_666).fee).toBe(100)
        // P=150,000: 6,000 + 0.05 × 50,000 = 8,500(소수 없음).
        expect(computeSellerFee(150_000).fee).toBe(8_500)
    })

    it('음수·비유한값·소수는 0/버림으로 방어한다', () => {
        expect(computeSellerFee(-5).fee).toBe(0)
        expect(computeSellerFee(Number.NaN).fee).toBe(0)
        // 소수는 버림 후 계산: floor(100000.9)=100000 → 6,000.
        expect(computeSellerFee(100_000.9).fee).toBe(6_000)
    })
})
