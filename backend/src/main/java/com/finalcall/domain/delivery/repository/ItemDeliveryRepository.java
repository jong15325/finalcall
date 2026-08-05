package com.finalcall.domain.delivery.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;

/**
 * 배송(우편함) 리포지토리(delivery, EPIC-ITEM-DELIVERY). FC-186 은 스키마·엔티티·리포지토리 골격까지 소유한다 —
 * enqueue(FC-187)·재청구 sweeper·APPLIED→IN_GAME reconciler(FC-188)·상태 조회(§10)가 이 조회면을 소비한다.
 *
 * <p>enqueue 는 fresh INSERT({@code saveAndFlush})로만 쓴다(SettlementRecorder PC clear 함정, FC-187). {@code sale_order_id}
 * UK 가 이중 배송을, {@code item_uuid} UK 가 게임 인벤 중복 apply 를 DB 에서 차단한다. 게임 소유 전이(claim/apply/defer)의
 * 정본 경로는 게임 서버의 조건부 CAS SQL(§5.2·후속 별건)이라 이 리포지토리 밖이다.
 */
public interface ItemDeliveryRepository extends JpaRepository<ItemDelivery, Long> {

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default ItemDelivery findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }

    /** public_id 로 단건 조회(구매자 배송 상세, §10.1). 미존재·비당사자는 호출 측이 {@code DELIVERY_001}(404)로 통일. */
    Optional<ItemDelivery> findByPublicId(String publicId);

    /**
     * poller/sweeper 스캔(§4·§7.1) — 주어진 상태들을 오래된 순으로 배치 조회한다. {@code (status, created_at)} 인덱스를
     * 커버한다(PENDING/DEFERRED 대기분·리스 만료 재청구 후보. 만료 시각 판정은 호출 측이 담당, FC-188).
     */
    List<ItemDelivery> findByStatusInOrderByCreatedAtAsc(Collection<DeliveryStatus> statuses, Limit limit);

    /**
     * 접속 claim/배송 상태 조회(§5.2 (1)·§10.1) — 수령자별 대기 배송을 오래된 순으로 조회한다.
     * {@code (recipient_user_id, status)} 인덱스를 커버한다(접속 시·Redis 신호 수신 시).
     */
    List<ItemDelivery> findByRecipientUserIdAndStatusInOrderByCreatedAtAsc(Long recipientUserId,
        Collection<DeliveryStatus> statuses);

    /**
     * 재판매(출품) 가드(§5.4·§6.1·D-F, FC-188) — 해당 {@code item_instance} 에 FAILED 아닌 배송(PENDING/CLAIMED/
     * DEFERRED/APPLIED)이 존재하는지. 출품 경로(auction/shop 등록)가 location='INVENTORY' CAS 에 더해 이 부재를
     * 검증해, 게임 전달 중·전달 완료(lag 창 포함) 아이템의 이중 출품·이중 존재를 원천 차단한다
     * ({@link DeliveryStatus#LISTING_BLOCKING_STATUSES} 을 인자로 받는다).
     */
    boolean existsByItemInstanceIdAndStatusIn(Long itemInstanceId, Collection<DeliveryStatus> statuses);

    /**
     * APPLIED→IN_GAME reconcile 후보 스캔(§5.4·§6.1·D-F, FC-188) — 게임 apply 성공(APPLIED)했으나 아직 IN_GAME
     * 으로 이관되지 않은 {@code item_instance} 를 가진 배송을 오래된 순으로 조회한다. 상관 EXISTS 서브쿼리로
     * 미이관분만 좁혀(이미 IN_GAME 인 APPLIED 는 제외) reconciler 가 매 tick 전건 재스캔하지 않게 한다({@code (status,
     * created_at)} 인덱스 활용, 웹 쓰기 소유 §5.4). 게임은 {@code item_instance} 를 쓰지 않으므로 이 전이는 웹 소관이다.
     */
    @Query("SELECT d FROM ItemDelivery d "
        + "WHERE d.status = com.finalcall.domain.delivery.entity.DeliveryStatus.APPLIED "
        + "AND EXISTS (SELECT 1 FROM ItemInstance i WHERE i.id = d.itemInstanceId "
        + "AND i.location <> com.finalcall.domain.item.entity.ItemLocation.IN_GAME) "
        + "ORDER BY d.createdAt ASC")
    List<ItemDelivery> findAppliedPendingReconcile(Limit limit);

    /**
     * 리스 만료 재청구 sweeper(CLAIMED→PENDING, §5.2·§5.4·§9.1·D-D·D-H, FC-188) — 게임이 청구(CLAIMED)한 뒤
     * {@code claimed_at + lease} 를 넘겨 apply/ack 를 못 마친 리스를 PENDING 으로 회수한다(게임 크래시 회수). 조건부
     * 벌크 CAS({@code WHERE status='CLAIMED' AND claimed_at < threshold})라 <b>단일 승자</b>이며 다중 웹 인스턴스가
     * 동시에 돌려도 행 락으로 직렬화돼 이중 회수가 없다. 재청구가 at-least-once 의 원천이고 이중 지급은 게임
     * {@code user_item.itm_uuid} UK 로 무해화된다(D-E). 회수 시 {@code claim_token}·{@code claimed_at} 을 비운다.
     * {@code clearAutomatically} 로 벌크 UPDATE 후 1차 캐시를 비워 후속 조회가 최신 상태를 보게 한다.
     *
     * @param threshold 리스 만료 경계 시각(= now − lease). 이보다 이전에 청구된 CLAIMED 만 회수
     * @return 이번 호출에 PENDING 으로 회수된 배송 행 수
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE ItemDelivery d "
        + "SET d.status = com.finalcall.domain.delivery.entity.DeliveryStatus.PENDING, "
        + "d.claimToken = null, d.claimedAt = null "
        + "WHERE d.status = com.finalcall.domain.delivery.entity.DeliveryStatus.CLAIMED "
        + "AND d.claimedAt < :threshold")
    int reclaimExpiredLeases(@Param("threshold") Instant threshold);
}
