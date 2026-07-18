package com.finalcall.domain.auction;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 경매 리포지토리(auction). 목록/상세 fetch join 은 {@link AuctionRepositoryCustom}(QueryDSL).
 */
public interface AuctionRepository extends JpaRepository<Auction, Long>, AuctionRepositoryCustom {

    /** public_id 로 managed 경매 조회. */
    Optional<Auction> findByPublicId(String publicId);

    /**
     * 판매자 취소 조건부 CAS(auction-domain-spec §4.2 · 게이트2 e/G6, FC-028). 상태가 SCHEDULED|ACTIVE 이고
     * 입찰이 없을 때(highest_bidder_id IS NULL)만 CANCELLED 로 단일 승자 전이한다.
     *
     * <p>영향행이 0이면 호출 측이 원인을 재조회로 분기한다(입찰 존재 → AUCTION_007 / 종료 상태 → AUCTION_006).
     * lazy 파생(startAt 도래한 SCHEDULED)은 표시층 전용이라 CAS 는 영속값 SCHEDULED·ACTIVE 를 모두 대상으로 한다.
     *
     * @return 영향 행 수(1=취소 성공, 0=취소 불가)
     */
    @Modifying
    @Query("UPDATE Auction a SET a.status = com.finalcall.domain.auction.AuctionStatus.CANCELLED "
        + "WHERE a.id = :id "
        + "AND a.status IN (com.finalcall.domain.auction.AuctionStatus.SCHEDULED, "
        + "com.finalcall.domain.auction.AuctionStatus.ACTIVE) "
        + "AND a.highestBidder IS NULL")
    int cancelIfCancellable(@Param("id") Long id);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Auction findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
