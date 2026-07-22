import type { ShopStatus } from '@/lib/api/shop'

/**
 * 고정가 상태·기한 표시 파생 (계약 §3.2 · shop-spec §2.1) — FC-094.
 *
 * ★ 경매의 `auctionPhase` 대응이나 훨씬 단순하다 — 입찰·예약·소프트클로즈가 없다. 구매 가능
 *   여부는 **판매 중(ACTIVE) ∧ 기한 전**뿐이다. 표시 제어용이며 **최종 판정은 서버**(SHOP_004).
 * ★ 순수 함수만 둔다(테스트 가벼움). 시각은 ms 주입(단일 타이머 `useNow`).
 */

/** 고정가 상태 → 표시 라벨. 미등록 상태는 코드 노출(무음 실패 방지 — `itemCode`·`element` 태도). */
export function shopStatusLabelOf(status: ShopStatus): string {
    switch (status) {
        case 'ACTIVE':
            return '판매 중'
        case 'SOLD':
            return '판매 완료'
        case 'EXPIRED':
            return '기한 만료'
        case 'CANCELLED':
            return '판매 취소'
        default:
            return String(status)
    }
}

/**
 * 구매 가능 여부(표시 제어) — `ACTIVE ∧ (무기한 ∨ 아직 기한 전)`.
 *
 * ★ 클라 판정은 버튼 활성/비활성용이고, **경합·만료 워커와의 최종 판정은 서버**가 한다
 *   (구매 응답 SHOP_004). 시간축은 구매(live)/만료(expired)로 배타 분할된다(shop-spec §4.1).
 */
export function isShopPurchasable(
    status: ShopStatus,
    endAt: string | null,
    now: number,
): boolean {
    if (status !== 'ACTIVE') return false
    if (endAt === null) return true
    const ms = Date.parse(endAt)
    return !Number.isFinite(ms) || now < ms
}

/**
 * 남은 판매기간(일). `endAt` 없으면(무기한) null, 이미 지났으면 0.
 *
 * ★ **경매의 카운트다운(HH:MM:SS)과 다르다** — 고정가는 마감 경쟁이 없어 초 단위 압박을 주지
 *   않는다. 일 단위 "N일 남음"으로만 안내한다(오해로 서두르게 하지 않는다).
 */
export function shopRemainingDays(
    endAt: string | null,
    now: number,
): number | null {
    if (endAt === null) return null
    const ms = Date.parse(endAt)
    if (!Number.isFinite(ms)) return null
    return Math.max(0, Math.ceil((ms - now) / 86_400_000))
}
