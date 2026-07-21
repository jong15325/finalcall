import type { AuctionPhase } from './auctionPhase'
import type { AuctionStatus } from '@/lib/api/auctions'

/**
 * 즉시구매 활성 조건 + 낙찰 결과 표기 (계약 §3.1 · purchase-spec §8) — FC-090.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★ **즉시구매는 `buyNowPrice` 가 있고 · 라이브이고 · 내 경매가 아닐 때만 켠다.**
 * ══════════════════════════════════════════════════════════════════════════════
 * 계약(purchase-spec §2·§3): 즉시구매 성립 조건은 `buy_now_price != null` ∧ live(진행 중) ∧
 * 판매자 본인 아님이다. 미설정이면 `AUCTION_005`, 미개시·종료면 `AUCTION_006`, 자기구매면
 * `AUCTION_009` 로 서버가 거절한다 — 화면은 그 전에 **표시 제어**로 버튼을 감추거나 라우팅한다
 * (마감 판정은 서버 status 불신, `auctionPhaseOf` 의 클라 `now>=endAt`).
 *
 * ★★ **표시 제어일 뿐 인가가 아니다.** 자기 경매 숨김·라이브 판정은 UX 이고, 서버 응답
 *    (AUCTION_005/006/009·BID_005)은 다이얼로그에서 **반드시 별도 처리**한다(`purchaseErrors`).
 */

/**
 * - `hidden`    — 버튼을 아예 그리지 않는다(미설정·내 경매·라이브 아님).
 * - `login`     — 비로그인. 구매하려면 로그인해야 하므로 로그인으로 유도한다.
 * - `available` — 로그인 + 라이브 + 타인 경매 + 즉시구매가 존재 → 구매 버튼 활성.
 */
export type BuyNowState = 'hidden' | 'login' | 'available'

export interface BuyNowInput {
    /** 즉시구매가(계약 `buyNowPrice`). 없으면 즉시구매 미설정 */
    buyNowPrice: number | null
    phase: AuctionPhase
    /** 판매자 본인 여부(닉네임 파생 표시 제어 — 인가는 서버 AUCTION_009) */
    isOwn: boolean
    isAuthed: boolean
}

export function buyNowStateOf({
    buyNowPrice,
    phase,
    isOwn,
    isAuthed,
}: BuyNowInput): BuyNowState {
    // 즉시구매 미설정 — 버튼 없음(참고가 표기도 없음).
    if (buyNowPrice === null || buyNowPrice === undefined) return 'hidden'
    // 자기 경매(wash trade 방지, AUCTION_009) — 미노출.
    if (isOwn) return 'hidden'
    // 라이브가 아니면(예약 미도래·마감·종료) 즉시구매 불가(AUCTION_006).
    if (phase !== 'live') return 'hidden'
    // 라이브·타인·설정됨 — 로그인 여부만 남는다.
    return isAuthed ? 'available' : 'login'
}

/**
 * 종료 상태 안내 문구 — **BUYNOW 낙찰을 포함**한다(기존 SOLD 표기 확장, task A).
 *
 * ★ 낙찰/유찰은 **서버 terminal status 일 때만 단정**한다. 시계상으로만 마감(서버 아직 ACTIVE)이면
 *   마감 워커가 상태를 굳히기 전이라 "결과 처리 중" 으로 흘린다(closing 전이 구간, 계약 §3.3 v1.12).
 *   즉시구매가 성립하면 상세가 `status='SOLD'` ∧ `resultType='BUYNOW'` 로 와서 아래 첫 분기를 탄다.
 */
export function endedResultNoteOf(
    status: AuctionStatus,
    resultType: string | null,
): string {
    switch (status) {
        case 'SOLD':
            return resultType === 'BUYNOW'
                ? '즉시구매로 낙찰되었습니다.'
                : '낙찰되었습니다.'
        case 'UNSOLD':
            return '유찰되었습니다.'
        case 'CANCELLED':
            return '취소된 경매입니다.'
        default:
            // 시계상 마감이나 서버 상태 미확정 — 마감 처리 중(결과 단정 금지).
            return '마감되었습니다. 결과가 곧 반영됩니다.'
    }
}
