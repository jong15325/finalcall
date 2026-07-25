package com.finalcall.domain.auction.entity;

/**
 * 경매 + 입찰 수 프로젝션 캐리어(auction, bid-domain-spec §7.3).
 *
 * <p>{@code bidCount} 를 경매 행에 비정규화하지 않고 조회 시 집계하는 이유는 <b>이중 진실 회피</b>다 —
 * 비정규화 컬럼은 입찰·취소·마감 등 모든 갱신 경로에 동기화 책임을 추가하고, 한 번 어긋나면 조용히 틀린 수치를
 * 계속 노출한다(auction-domain-spec §9-e 가 같은 이유로 기각한 선례). 대신 목록/상세 쿼리에 <b>상관 서브쿼리</b>를
 * 실어 경매 건수와 무관하게 쿼리 수를 1로 고정한다(N+1 방지).
 *
 * @param auction  fetch join 으로 표시 연관이 초기화된 경매
 * @param bidCount 해당 경매의 총 입찰 수(OUTBID 포함 — 이력 전체가 "입찰 수"다)
 */
public record AuctionWithBidCount(Auction auction, long bidCount) {
}
