package com.finalcall.domain.auction.entity;

import java.time.Instant;

/**
 * 즉시구매 판정에 필요한 경매 값의 스칼라 스냅샷(auction, purchase-spec §3.4).
 *
 * <p>엔티티가 아니라 <b>프로젝션</b>인 이유는 마감·입찰과 같다: (1) 경매 행에 {@code FOR UPDATE} 를 걸 때 연관을
 * {@code a.seller.id} 로 읽어 조인을 만들지 않으므로 단일 테이블 잠금이 유지되고({@link AuctionBidContext} 선례),
 * (2) 즉시구매 절차가 잔액 조건부 UPDATE({@code decreaseGameMoney})·홀드 해제로 영속성 컨텍스트를 clear 하므로
 * (§3.4 PC clear 함정) 판정 근거를 값으로 복사해 두어야 detach 영향을 받지 않는다.
 *
 * <p>기존 {@link AuctionBidContext} 는 {@code itemInstanceId} 가 없고 {@link AuctionCloseContext} 는
 * {@code buyNowPrice}·{@code startAt} 이 없어 <b>어느 것도 그대로 못 쓴다</b> → 즉시구매 전용 신규 프로젝션이다.
 * live 판정은 {@code status}·{@code startAt}·{@code endAt} 을, 재검증은 {@code buyNowPrice}·{@code sellerId} 를,
 * 정산 꼬리는 {@code itemInstanceId} 를 근거로 한다.
 *
 * @param id               경매 PK
 * @param sellerId         판매자 PK — 자기구매 차단(AUCTION_009) 근거
 * @param status           영속 상태 — live 판정(미개시·종료 → AUCTION_006) 근거
 * @param startAt          예약 개시 시각(null 이면 즉시 개시)
 * @param endAt            현재 마감 시각 — live 판정(now &lt; endAt) 근거
 * @param buyNowPrice      즉시구매가(nullable) — 없으면 AUCTION_005, 있으면 finalPrice
 * @param itemInstanceId   출품 아이템 PK(구매자 이전 대상)
 * @param highestBidderId  현재 최고 입찰자 PK(nullable) — 본인구매 허용 판단 참고(패자 해제는 bid 조회로 한다)
 * @param highestBidAmount 현재 최고가(nullable)
 */
public record AuctionPurchaseContext(
    Long id,
    Long sellerId,
    AuctionStatus status,
    Instant startAt,
    Instant endAt,
    Long buyNowPrice,
    Long itemInstanceId,
    Long highestBidderId,
    Long highestBidAmount) {
}
