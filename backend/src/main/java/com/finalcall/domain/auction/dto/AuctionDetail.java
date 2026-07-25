package com.finalcall.domain.auction.dto;

import com.finalcall.domain.auction.entity.Auction;

/**
 * 경매 상세 조회 결과(auction, 계약 §3.3 {@code AuctionDetail}). 엔티티만으로는 표현할 수 없는 <b>파생값</b>을
 * 서비스가 계산해 함께 실어 보낸다 — 표현 계층(record DTO 의 static from)은 스프링 빈에 접근할 수 없으므로
 * 설정 의존 파생값을 그곳에서 계산할 수 없다.
 *
 * @param auction          fetch join 으로 표시 연관(item·template·skill·seller·highestBidder)이 초기화된 경매
 * @param bidCount         총 입찰 수(상관 서브쿼리 집계)
 * @param minNextBidAmount 다음 입찰 최소 금액(계약 v1.8 F3). <b>종료 상태 경매는 null</b> — 더 이상 입찰이
 *                         성립하지 않는데 금액을 안내하면 클라이언트가 입찰 UI 를 열어 실패를 유도한다
 */
public record AuctionDetail(Auction auction, long bidCount, Long minNextBidAmount) {
}
