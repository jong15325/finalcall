package com.finalcall.domain.auction;

import java.time.Instant;

/**
 * 마감 전이 판정에 필요한 경매 값의 스칼라 스냅샷(auction, EPIC-CLOSING §3.2).
 *
 * <p>엔티티가 아니라 <b>프로젝션</b>인 이유는 두 가지다: (1) 경매 행에 {@code FOR UPDATE} 를 걸 때 연관을
 * {@code a.seller.id} 로 읽어 조인을 만들지 않으므로 단일 테이블 잠금이 유지된다({@link AuctionBidContext} 선례),
 * (2) SOLD 절차가 잔액 조건부 UPDATE 로 영속성 컨텍스트를 clear 하므로(bid-domain-spec §4.2) 판정 근거를 값으로
 * 복사해 두어야 detach 영향을 받지 않는다.
 *
 * <p>{@code highestBidderId} 가 마감 분기의 축이다 — NOT NULL 이면 SOLD(§4), NULL 이면 UNSOLD(§5)다. 마감 재검증은
 * 락 스냅샷의 <b>최신 {@code endAt}</b>(소프트클로즈 막판 연장 반영)을 근거로 한다(I-G).
 *
 * @param highestBidAmount 최고가. 입찰이 없으면 {@code null}(UNSOLD 경로)
 * @param highestBidderId  최고입찰자 PK. 없으면 {@code null}(UNSOLD 경로)
 * @param itemInstanceId   출품 아이템 PK(SOLD=낙찰자 이전 대상 / UNSOLD=판매자 반환 대상)
 */
public record AuctionCloseContext(
    Long id,
    Long sellerId,
    AuctionStatus status,
    Instant endAt,
    Long highestBidderId,
    Long highestBidAmount,
    Long itemInstanceId) {
}
