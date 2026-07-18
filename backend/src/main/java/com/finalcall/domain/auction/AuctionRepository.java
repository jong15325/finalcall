package com.finalcall.domain.auction;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.member.User;

import jakarta.persistence.LockModeType;

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

    /**
     * ★ 입찰 직렬화의 진입점(bid-domain-spec §4.1 1단계) — 경매 행에 배타 락을 걸고 판정에 필요한 값만 읽는다.
     * {@code SELECT ... FROM auction WHERE public_id = ? FOR UPDATE} 로 나가며, <b>이 시점부터 커밋까지 동일
     * 경매의 다른 입찰은 이 행에서 대기한다</b> = 경매 단위 직렬화(D-008).
     *
     * <p>게이트2 (a) 결정에 따라 직렬화 경계는 Redis 분산락이 아니라 DB 행 락이다. 락 수명이 트랜잭션 수명과
     * 정확히 같아 임대 만료·GC 정지로 상호배제가 풀리는 창이 존재하지 않고, Redis 장애가 입찰 전면 중단으로
     * 전파되지도 않는다(domain-spec §8 "정합성은 DB").
     *
     * <p>엔티티가 아닌 스칼라 프로젝션을 반환하는 이유는 {@link AuctionBidContext} 참조. 연관을 {@code a.seller.id}
     * 로 읽어 조인이 생기지 않으므로 {@code FOR UPDATE} 가 단일 테이블 잠금으로 유지된다.
     *
     * @return 락을 획득한 경매의 값 스냅샷. 없으면 비어 있다(→ AUCTION_004)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT new com.finalcall.domain.auction.AuctionBidContext("
        + "a.id, a.seller.id, a.status, a.startAt, a.endAt, a.maxEndAt, "
        + "a.softCloseWindowSec, a.softCloseExtendSec, a.extensionCount, "
        + "a.startPrice, a.buyNowPrice, a.highestBidAmount, a.highestBidder.id) "
        + "FROM Auction a WHERE a.publicId = :publicId")
    Optional<AuctionBidContext> findBidContextForUpdate(@Param("publicId") String publicId);

    /**
     * 입찰 성립에 따른 경매 갱신을 <b>단일 UPDATE 문</b>으로 수행한다(§4.1 7단계 · §5 · §6).
     *
     * <p>최고가·최고입찰자·상태 승격·마감 연장을 한 문장에 담는 이유는 부분 갱신 상태를 없애기 위해서다.
     * 특히 소프트클로즈 연장은 "입찰은 성공했는데 연장이 누락"되는 틈이 생기면 안 되므로 입찰 수용과 동일한
     * 직렬화 단위·동일 문장이어야 한다(domain-spec §8).
     *
     * <p><b>dirty-checking 을 쓰지 않는 이유(§4.2)</b>: 이 메서드는 잔액 조건부 UPDATE 이후에 호출되는데,
     * 그것이 영속성 컨텍스트를 clear 해 락 스냅샷 엔티티가 detach 된다. 엔티티 갱신에 의존하면 변경이
     * <b>예외 없이 조용히 유실</b>된다. {@code clearAutomatically} 는 같은 함정을 확산시키므로 붙이지 않는다.
     *
     * @param status         승격 후 상태(SCHEDULED 이고 개시 도래면 ACTIVE, 그 외 기존값 유지)
     * @param endAt          연장 판정 결과 마감 시각(연장 없으면 기존값 그대로)
     * @param extensionCount 연장 판정 결과 누적 연장 횟수(상한 클램프로 실제 연장이 없었으면 기존값 그대로)
     * @return 영향 행 수(1=갱신 성공, 0=대상 없음 → 불변식 위반이므로 호출 측이 예외로 롤백)
     */
    @Modifying
    @Query("UPDATE Auction a SET a.highestBidAmount = :amount, a.highestBidder = :bidder, "
        + "a.status = :status, a.endAt = :endAt, a.extensionCount = :extensionCount "
        + "WHERE a.id = :id")
    int applyBid(@Param("id") Long id,
        @Param("amount") long amount,
        @Param("bidder") User bidder,
        @Param("status") AuctionStatus status,
        @Param("endAt") Instant endAt,
        @Param("extensionCount") int extensionCount);

    /**
     * 취소 CAS 실패(0행) 원인 판정을 위한 <b>최신 상태</b> 재조회(§4.6).
     *
     * <p>배타 락으로 읽는 이유가 핵심이다. MySQL 기본 격리수준 REPEATABLE READ 에서 일반 SELECT 는 트랜잭션
     * 시작 시점의 일관 읽기 스냅샷을 본다 — 취소 트랜잭션이 이미 경매를 한 번 읽은 뒤이므로, 그 사이 커밋된
     * 동시 입찰의 {@code highest_bidder_id} 가 <b>보이지 않는다</b>. 그러면 스칼라 프로젝션으로 1차 캐시를
     * 우회해도 여전히 옛 값을 읽어 오분류가 재현된다. 잠금 읽기는 항상 최신 커밋 버전을 읽으므로 이 창이 닫힌다.
     *
     * <p>대기 비용은 없다시피 하다: CAS 가 0행을 반환했다는 것은 경합 트랜잭션이 이미 커밋을 끝냈다는 뜻이고
     * (아직 진행 중이었다면 UPDATE 가 행 락에서 대기했을 것이다), 호출 측은 이 값을 읽은 직후 예외로 롤백한다.
     *
     * @return 최신 상태 스냅샷(입찰 존재 여부 판정 근거)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT new com.finalcall.domain.auction.AuctionCancelState(a.status, a.highestBidder.id) "
        + "FROM Auction a WHERE a.id = :id")
    Optional<AuctionCancelState> findCancelStateForUpdate(@Param("id") Long id);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Auction findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
