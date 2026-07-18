package com.finalcall.domain.auction;

/**
 * 취소 CAS 실패(0행) 원인 판정용 <b>최신 상태 스냅샷</b>(bid-domain-spec §4.6).
 *
 * <p>왜 엔티티 재조회가 아니라 스칼라 프로젝션인가: {@code cancelIfCancellable} 에는 {@code clearAutomatically}
 * 가 없어 1차 캐시가 CAS <b>이전</b>에 로드한 엔티티를 그대로 돌려준다. 그 엔티티의 {@code highestBidder} 는
 * 아직 null 이라, 동시 입찰이 방금 최고입찰자를 채워 CAS 가 0행이 된 상황에서도 "입찰 있음"(AUCTION_007)이 아니라
 * "이미 종료"(AUCTION_006)로 <b>오분류</b>된다. 스칼라 프로젝션은 1차 캐시를 우회해 DB 를 직접 읽는다.
 *
 * @param status          최신 영속 상태 — 종료 상태면 AUCTION_006
 * @param highestBidderId 최신 최고 입찰자 PK — 비어 있지 않으면 AUCTION_007
 */
public record AuctionCancelState(AuctionStatus status, Long highestBidderId) {
}
