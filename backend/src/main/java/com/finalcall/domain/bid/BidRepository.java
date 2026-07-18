package com.finalcall.domain.bid;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 입찰 리포지토리(bid).
 *
 * <p>상태 전이는 엔티티 dirty-checking 이 아니라 조건부 {@code @Modifying} UPDATE 로 수행한다(D-008). 조건을
 * {@code WHERE} 절에 담아 DB 행 락 아래에서 평가하므로 이중 전이가 성립하지 않고, 반환값(영향행 수)이 곧 판정이다.
 *
 * <p><b>{@code clearAutomatically} 를 붙이지 않는다.</b> 영속성 컨텍스트를 통째로 비우면 호출 측이 들고 있던
 * 관리 엔티티가 detach 되어 이후 갱신이 예외 없이 유실된다 — {@code UserBalanceRepository} 가 이미 그 성질을
 * 갖고 있어(bid-domain-spec §4.2) 같은 함정을 확산시키지 않는다. 호출 측은 값 스냅샷({@link BidSnapshot})을
 * 근거로 동작하도록 설계돼 있어 자동 clear 가 필요 없다.
 */
public interface BidRepository extends JpaRepository<Bid, Long> {

    /** public_id 로 입찰 조회(외부 식별자 B-004). */
    Optional<Bid> findByPublicId(String publicId);

    /**
     * 경매의 <b>현재 최고 입찰</b>을 값 스냅샷으로 조회한다(bid-domain-spec §4.3).
     *
     * <p>경매 행 배타 락 아래에서 호출하는 것을 전제한다 — 그 구간에서는 경매당 {@code ACTIVE} 입찰이 최대 1건
     * (불변식 I1)이라 단건 바인딩이 안전하다. 인덱스 {@code (auction_id, amount DESC)} 가 커버한다: 입찰 금액이
     * 단조 증가(I2)하므로 선두 행이 곧 현재 최고 입찰이며, {@code (auction_id, status)} 인덱스는 두지 않는다.
     *
     * @return 직전 최고 입찰 스냅샷. 첫 입찰이면 비어 있다
     */
    @Query("SELECT new com.finalcall.domain.bid.BidSnapshot(b.id, b.bidder.id, b.amount) FROM Bid b "
        + "WHERE b.auction.id = :auctionId "
        + "AND b.status = com.finalcall.domain.bid.BidStatus.ACTIVE")
    Optional<BidSnapshot> findActiveByAuctionId(@Param("auctionId") Long auctionId);

    /**
     * 상위 입찰 발생에 따른 ACTIVE→OUTBID 조건부 CAS(P-008). 이미 OUTBID·WON 이면 전이하지 않는다.
     *
     * <p>영향행이 0이면 "밀어낼 최고 입찰이 이미 없었다"는 뜻이라 <b>불변식 위반</b>이다 — 호출 측은 이를 무시하지
     * 않고 예외로 올려 트랜잭션 전체를 롤백해야 한다(조용한 최고가 드리프트 방지).
     *
     * @return 영향 행 수(1=전이 성공, 0=대상이 ACTIVE 가 아님)
     */
    @Modifying
    @Query("UPDATE Bid b SET b.status = com.finalcall.domain.bid.BidStatus.OUTBID "
        + "WHERE b.id = :bidId "
        + "AND b.status = com.finalcall.domain.bid.BidStatus.ACTIVE")
    int markOutbidIfActive(@Param("bidId") Long bidId);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Bid findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
