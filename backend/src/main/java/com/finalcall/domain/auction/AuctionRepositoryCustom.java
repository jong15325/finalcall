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

    /**
     * 검색 하이드레이션(EPIC-SEARCH) — ES 가 관련도 순으로 준 public_id 목록의 표시 데이터를 MySQL(정본)에서 읽는다
     * (search-spec §12.8 "정확값은 DB"). 목록/상세와 동일한 fetch join(item·template·skill·seller) + 입찰 수 집계다.
     * <b>정렬은 보장하지 않는다</b> — 호출 측(서비스)이 ES 순서대로 재배열한다(IN 절은 순서를 보존하지 않음).
     */
    List<AuctionWithBidCount> findSummariesByPublicIds(List<String> publicIds);

    /**
     * 재색인 대상 전건(EPIC-SEARCH, {@code ListingIndexer}) — 코드축 enrichment 를 위해 item·template·skill·seller 를
     * fetch join 해 읽는다. 화해 보정·수동 백필 경로가 쓴다(§12.5). 데모 규모 전제(대량이면 keyset 배치로 분할).
     */
    List<Auction> findAllForIndexing();
}
