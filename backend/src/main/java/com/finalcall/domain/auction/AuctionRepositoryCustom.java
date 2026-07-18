package com.finalcall.domain.auction;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * 경매 커스텀 쿼리 계약(auction, QueryDSL 구현은 {@link AuctionRepositoryImpl}). 목록/상세 응답은 item 표시 블록
 * (template·skill live join) + seller 를 함께 노출하므로 to-one fetch join 으로 N+1 을 제거한다(OSIV off 전제).
 */
public interface AuctionRepositoryCustom {

    /** 상세(계약 §3.1 GET /auctions/{id}) — itemInstance·template·skill1/2·seller fetch join. */
    Optional<Auction> findDetailByPublicId(String publicId);

    /**
     * 목록(계약 §3.1 GET /auctions) — 공통 필터 + keyset cursor. hasNext 판단을 위해 {@code size + 1}건 조회한다.
     *
     * @param now goldforceActive 필터 기준 시각(gf_expire_at 비교)
     */
    List<Auction> findByCursor(AuctionSearchCondition condition, AuctionCursor cursor, int size, Instant now);
}
