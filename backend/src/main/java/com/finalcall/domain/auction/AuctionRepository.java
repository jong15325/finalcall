package com.finalcall.domain.auction;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Pageable;
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
     * public_id → 내부 PK 해석(외부 식별자 B-004). 경매 본문이 필요 없는 종속 리소스 조회
     * (예: {@code GET /auctions/{id}/bids})가 경매 전체 행·연관을 끌어오지 않도록 스칼라만 읽는다.
     * 비어 있으면 {@code AUCTION_004}(404) 판정의 근거가 된다.
     */
    @Query("SELECT a.id FROM Auction a WHERE a.publicId = :publicId")
    Optional<Long> findIdByPublicId(@Param("publicId") String publicId);

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

    /**
     * ★ 마감 워커 후보 스캔(closing-domain-spec §3.1) — 마감 시각이 지난 미종결 경매의 id 만 뽑는다.
     *
     * <p>후보 스캔과 실제 전이를 분리한다: 여기서는 <b>락 없이 짧게</b> id 만 읽고, 전이는 경매 1건씩 독립 TX +
     * 행 락으로 처리한다({@code CloseService.closeOne}). 스캔 대상은 {@code ACTIVE} 만이 아니라
     * <b>{@code SCHEDULED} 도 포함</b>한다(§1.1) — start_at 미래로 등록된 예약 경매가 입찰 0건으로 마감 시각을
     * 지나면 영속값이 SCHEDULED 에 고인 채 UNSOLD 로 종결돼야 하기 때문이다. 인덱스 {@code (status, end_at)}
     * (V10)가 status 별 range 스캔으로 커버한다. 오래 밀린 것부터 처리하도록 {@code end_at} 오름차순이다.
     *
     * @param now      마감 판정 기준 시각
     * @param pageable {@code LIMIT batchSize}(한 tick 처리량 상한). 못 딴 후보는 다음 tick 이 재스캔한다
     * @return 마감 후보 경매 id 목록(end_at 오름차순)
     */
    @Query("SELECT a.id FROM Auction a "
        + "WHERE a.status IN (com.finalcall.domain.auction.AuctionStatus.SCHEDULED, "
        + "com.finalcall.domain.auction.AuctionStatus.ACTIVE) "
        + "AND a.endAt <= :now "
        + "ORDER BY a.endAt ASC")
    List<Long> findClosableIds(@Param("now") Instant now, Pageable pageable);

    /**
     * ★ 마감 전이 직렬화의 진입점(closing-domain-spec §3.2 1단계) — 경매 행에 배타 락을 걸고 판정에 필요한 값만
     * 읽는다. {@code SELECT ... FROM auction WHERE id = ? FOR UPDATE} 로 나가며, 이 락은 <b>입찰과 동일 행</b>을
     * 잡으므로(bid-domain-spec §4.1) 진행 중인 입찰 TX 뒤에서 대기하고, 락을 얻으면 그 입찰이 반영된 최신
     * {@code end_at}·{@code highest_bidder_id} 를 본다 → 입찰과 마감의 경합이 DB 직렬화로 자동 해소된다.
     *
     * <p>엔티티가 아닌 스칼라 프로젝션을 반환하는 이유는 {@link AuctionCloseContext} 참조. 연관을
     * {@code a.seller.id} 등으로 읽어 조인이 생기지 않으므로 {@code FOR UPDATE} 가 단일 테이블 잠금으로 유지된다.
     *
     * @return 락을 획득한 경매의 값 스냅샷. 없으면 비어 있다(이미 삭제됨 — 정상 skip)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT new com.finalcall.domain.auction.AuctionCloseContext("
        + "a.id, a.seller.id, a.status, a.endAt, a.highestBidder.id, a.highestBidAmount, a.itemInstance.id) "
        + "FROM Auction a WHERE a.id = :id")
    Optional<AuctionCloseContext> findCloseContextForUpdate(@Param("id") Long id);

    /**
     * 낙찰 종료성 CAS(closing-domain-spec §4.1 9단계) — SCHEDULED|ACTIVE 이고 마감 시각이 지났을 때만 SOLD 로
     * 단일 승자 전이하며 {@code result_type='BID'} 를 세팅한다. {@code highest_bid_amount}·{@code highest_bidder}
     * 는 입찰 TX 가 이미 세팅했으므로 덮어쓰지 않는다(status·result_type 만).
     *
     * <p>영향행 0 = "이미 종결됨"(다른 인스턴스가 처리했거나 막판 연장으로 end_at 이 밀림) → 재시도가 아니라
     * 무부작용 판정이다(I-F·I-G, bid-domain-spec §4.6.2 CAS 0행 원인판정과 동류). 행 락 하 재검증이 앞서므로
     * 정상 경로에서 이 CAS 는 항상 1행이며, 0행이면 호출 측이 불변식 위반으로 롤백한다.
     *
     * @return 영향 행 수(1=전이 성공, 0=이미 종결·연장)
     */
    @Modifying
    @Query("UPDATE Auction a SET a.status = com.finalcall.domain.auction.AuctionStatus.SOLD, "
        + "a.resultType = com.finalcall.domain.auction.AuctionResultType.BID "
        + "WHERE a.id = :id "
        + "AND a.status IN (com.finalcall.domain.auction.AuctionStatus.SCHEDULED, "
        + "com.finalcall.domain.auction.AuctionStatus.ACTIVE) "
        + "AND a.endAt <= :now")
    int markSoldIfClosable(@Param("id") Long id, @Param("now") Instant now);

    /**
     * 유찰 종료성 CAS(closing-domain-spec §5) — SCHEDULED|ACTIVE 이고 마감 시각이 지났을 때만 UNSOLD 로 전이한다.
     * {@code result_type} 은 NULL 유지(SOLD 가 아니므로 BID/BUYNOW 어느 것도 아님, erd §4.2 정합).
     *
     * @return 영향 행 수(1=전이 성공, 0=이미 종결·연장)
     */
    @Modifying
    @Query("UPDATE Auction a SET a.status = com.finalcall.domain.auction.AuctionStatus.UNSOLD "
        + "WHERE a.id = :id "
        + "AND a.status IN (com.finalcall.domain.auction.AuctionStatus.SCHEDULED, "
        + "com.finalcall.domain.auction.AuctionStatus.ACTIVE) "
        + "AND a.endAt <= :now")
    int markUnsoldIfClosable(@Param("id") Long id, @Param("now") Instant now);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Auction findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
