package com.finalcall.domain.auction;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 경매 커스텀 쿼리 계약(auction, QueryDSL 구현은 {@link AuctionRepositoryImpl}). 목록/상세 응답은 item 표시 블록
 * (template·skill live join) + seller 를 함께 노출하므로 to-one fetch join 으로 N+1 을 제거한다(OSIV off 전제).
 */
public interface AuctionRepositoryCustom {

    /**
     * 상세(계약 §3.1 GET /auctions/{id}) — itemInstance·template·skill1/2·seller·highestBidder fetch join +
     * 입찰 수 상관 서브쿼리. {@code highestBidder} 까지 fetch 하는 이유는 응답의 {@code highestBidderMasked} 가
     * 닉네임을 읽기 때문이다(OSIV off — 표현 계층 lazy 접근 불가).
     */
    Optional<AuctionWithBidCount> findDetailByPublicId(String publicId);

    /**
     * 목록(계약 §3.1 GET /auctions) — 공통 필터 + keyset cursor + 입찰 수 상관 서브쿼리.
     * hasNext 판단을 위해 {@code size + 1}건 조회한다.
     *
     * @param now goldforceActive 필터 기준 시각(gf_expire_at 비교)
     */
    List<AuctionWithBidCount> findByCursor(
        AuctionSearchCondition condition, AuctionCursor cursor, int size, Instant now);
}
