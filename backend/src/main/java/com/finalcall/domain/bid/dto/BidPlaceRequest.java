package com.finalcall.domain.bid.dto;

import jakarta.validation.constraints.Positive;

/**
 * 입찰 요청 바디(계약 §3.1 POST /auctions/{auctionPublicId}/bids).
 *
 * <p><b>필드가 {@code amount} 하나뿐인 것이 설계다.</b> 입찰자 식별자를 받지 않으므로 타인 명의 입찰(IDOR)이
 * 구조적으로 불가능하고, 최소 증분·홀드액·최고가 같은 파생값도 받지 않으므로 클라이언트가 계산한 값이 서버
 * 판정에 섞여 들어갈 여지가 없다(§9 "금액은 서버 재계산").
 *
 * <p>{@code @Positive} 는 형식 검증(400)이며 비즈니스 하한은 서버가 락 스냅샷으로 재판정한다(BID_001, 422).
 *
 * @param amount 입찰액(양수)
 */
public record BidPlaceRequest(@Positive Long amount) {

    /** 경매 식별자는 경로 변수에서, 입찰자는 SecurityContext 에서 온다 — 바디는 금액만 기여한다. */
    public BidPlaceCommand toCommand(String auctionPublicId) {
        return new BidPlaceCommand(auctionPublicId, amount);
    }
}
