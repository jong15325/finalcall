package com.finalcall.domain.bid;

/**
 * 입찰 요청 커맨드(계약 §3.1 POST /auctions/{id}/bids).
 *
 * <p><b>입찰자를 담지 않는다.</b> 주체는 언제나 {@code SecurityContext} 에서 도출한다(B-009 · 계약 §1.2
 * "X-User-Id 등 헤더 신뢰 없음"). 커맨드에 {@code bidderId} 자리를 만들어 두면 언젠가 요청 본문·헤더에서 채우는
 * 경로가 생기고 그 순간 IDOR 이 성립한다 — 애초에 자리를 두지 않는 편이 안전하다.
 *
 * <p>파생값(최소 증분·홀드액·최고가)도 받지 않는다. 전부 서버가 락 스냅샷에서 재계산한다(§9).
 *
 * @param auctionPublicId 대상 경매 외부 식별자
 * @param amount          입찰액
 */
public record BidPlaceCommand(String auctionPublicId, long amount) {
}
