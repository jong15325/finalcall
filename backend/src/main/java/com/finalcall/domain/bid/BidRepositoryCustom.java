package com.finalcall.domain.bid;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * 입찰 커스텀 쿼리 계약(bid, QueryDSL 구현은 {@link BidRepositoryImpl}).
 */
public interface BidRepositoryCustom {

    /**
     * 경매의 입찰 이력 offset 페이지(계약 §3.1 {@code GET /auctions/{id}/bids}, §1.3 "관리·소규모는 offset 예외").
     *
     * <p>정렬은 {@code amount desc} + id tiebreaker 로 고정이다. 입찰 금액은 경매 안에서 단조 증가(I2)하므로
     * 금액 내림차순이 곧 최신순이며, 기존 인덱스 {@code (auction_id, amount DESC)} 가 그대로 커버한다.
     *
     * @param auctionId 대상 경매 내부 PK(publicId 해석은 호출 측 책임)
     */
    Page<Bid> findPageByAuctionId(Long auctionId, Pageable pageable);
}
