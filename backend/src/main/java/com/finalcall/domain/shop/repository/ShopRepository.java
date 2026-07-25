package com.finalcall.domain.shop.repository;

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
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopExpireContext;
import com.finalcall.domain.shop.entity.ShopPurchaseContext;

import jakarta.persistence.LockModeType;

/**
 * 고정가 리포지토리(shop). 목록/상세 fetch join 은 {@link ShopRepositoryCustom}(QueryDSL). 종료성 전이는 조건부
 * CAS UPDATE 가 단일 진실원이다(domain-spec §8 "정합성은 DB").
 */
public interface ShopRepository extends JpaRepository<Shop, Long>, ShopRepositoryCustom {

    /** public_id 로 managed 고정가 조회. */
    Optional<Shop> findByPublicId(String publicId);

    /**
     * ★ 구매 직렬화의 진입점(shop-spec §4.1 1단계) — shop 행에 배타 락을 걸고 판정에 필요한 값만 읽는다.
     * {@code SELECT ... FROM shop WHERE public_id = ? FOR UPDATE} 로 나가며, <b>이 시점부터 커밋까지 동일 고정가의
     * 다른 구매·취소·만료는 이 행에서 대기한다</b> = 리스팅 단위 직렬화. 세 경로가 한 행 락 + status CAS 로 단일
     * 승자가 된다(shop-spec §4.1).
     *
     * <p>엔티티가 아닌 스칼라 프로젝션({@link ShopPurchaseContext})을 반환하는 이유: 연관을 {@code s.seller.id}·
     * {@code s.itemInstance.id} 로 읽어 조인이 생기지 않으므로 {@code FOR UPDATE} 가 단일 테이블 잠금으로 유지되고,
     * 구매 절차의 PC clear(잔액 차감·정산)에도 판정 근거가 detach 되지 않는다.
     *
     * @return 락을 획득한 고정가의 값 스냅샷. 없으면 비어 있다(→ SHOP_003)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT new com.finalcall.domain.shop.entity.ShopPurchaseContext("
        + "s.id, s.seller.id, s.status, s.endAt, s.price, s.itemInstance.id) "
        + "FROM Shop s WHERE s.publicId = :publicId")
    Optional<ShopPurchaseContext> findPurchaseContextForUpdate(@Param("publicId") String publicId);

    /**
     * ★ 만료 전이 직렬화의 진입점(shop-spec §4.4) — shop 행에 배타 락을 걸고 판정에 필요한 값만 읽는다. 구매·취소와
     * 동일 행을 잡으므로 세 경로가 status CAS 단일 승자로 경합 해소된다(closing I-F 대칭).
     *
     * @return 락을 획득한 고정가의 값 스냅샷. 없으면 비어 있다(이미 삭제됨 — 정상 skip)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT new com.finalcall.domain.shop.entity.ShopExpireContext("
        + "s.id, s.status, s.endAt, s.itemInstance.id) "
        + "FROM Shop s WHERE s.id = :id")
    Optional<ShopExpireContext> findExpireContextForUpdate(@Param("id") Long id);

    /**
     * ★ 만료 워커 후보 스캔(shop-spec §4.4) — 판매 기한이 지난 ACTIVE 리스팅의 id 만 뽑는다. 후보 스캔과 실제
     * 전이를 분리한다(락 없이 짧게 id 만 읽고, 전이는 1건씩 독립 TX + 행 락). 무기한(end_at NULL)은
     * {@code end_at IS NOT NULL} 로 스캔에서 제외한다(SOLD·CANCELLED 로만 종결). 인덱스 {@code (status, end_at)} 가
     * status 별 range 스캔으로 커버한다. 오래 밀린 것부터 처리하도록 {@code end_at} 오름차순이다.
     *
     * @param now      만료 판정 기준 시각
     * @param pageable {@code LIMIT batchSize}(한 tick 처리량 상한). 못 딴 후보는 다음 tick 이 재스캔한다
     * @return 만료 후보 고정가 id 목록(end_at 오름차순)
     */
    @Query("SELECT s.id FROM Shop s "
        + "WHERE s.status = com.finalcall.domain.shop.entity.ShopStatus.ACTIVE "
        + "AND s.endAt IS NOT NULL AND s.endAt <= :now "
        + "ORDER BY s.endAt ASC")
    List<Long> findExpirableIds(@Param("now") Instant now, Pageable pageable);

    /**
     * 구매 종료성 CAS(shop-spec §4.1 6단계) — ACTIVE 이고 <b>아직 판매 가능(live)</b>일 때만 SOLD 로 단일 승자
     * 전이한다. 시간 조건이 {@code end_at IS NULL OR end_at > now}(live)라 만료 워커의 {@code end_at <= now}(expired)와
     * <b>시간축을 배타 분할</b>한다: 만료 시각을 막 지난 리스팅이 구매·만료 어느 한쪽으로만 종결된다(S-G).
     *
     * <p>영향행 0 = "이미 판매·종료됨"(다른 구매자·취소·만료가 선점) → 재검증이 앞서므로 정상 경로에서 이 CAS 는
     * 항상 1행이며, 0행이면 호출 측이 불변식 위반으로 롤백한다.
     *
     * @return 영향 행 수(1=전이 성공, 0=이미 종결·경합 패배)
     */
    @Modifying
    @Query("UPDATE Shop s SET s.status = com.finalcall.domain.shop.entity.ShopStatus.SOLD "
        + "WHERE s.id = :id "
        + "AND s.status = com.finalcall.domain.shop.entity.ShopStatus.ACTIVE "
        + "AND (s.endAt IS NULL OR s.endAt > :now)")
    int markShopSoldIfPurchasable(@Param("id") Long id, @Param("now") Instant now);

    /**
     * 취소 종료성 CAS(shop-spec §4.3) — ACTIVE 일 때만 CANCELLED 로 단일 승자 전이한다. 취소 CAS 에는
     * <b>시간 조건이 없다</b>: 만료 시각을 지났지만 아직 ACTIVE 인 리스팅도 판매자가 취소할 수 있다(만료 워커와
     * status CAS 단일 승자로 경합 해소 — 어느 쪽이 이겨도 아이템은 판매자에게 회수, 목적지만 다름).
     *
     * <p>영향행 0 = 이미 SOLD·EXPIRED·CANCELLED → 호출 측이 SHOP_004(409)로 매핑한다.
     *
     * @return 영향 행 수(1=취소 성공, 0=이미 종결)
     */
    @Modifying
    @Query("UPDATE Shop s SET s.status = com.finalcall.domain.shop.entity.ShopStatus.CANCELLED "
        + "WHERE s.id = :id AND s.status = com.finalcall.domain.shop.entity.ShopStatus.ACTIVE")
    int markShopCancelledIfActive(@Param("id") Long id);

    /**
     * 만료 종료성 CAS(shop-spec §4.4) — ACTIVE 이고 유한 기한이 지났을 때만 EXPIRED 로 단일 승자 전이한다. 시간
     * 조건 {@code end_at IS NOT NULL AND end_at <= now}(expired)가 구매의 live 조건과 시간축을 배타 분할한다.
     *
     * <p>영향행 0 = "이미 종결됨"(다른 인스턴스가 처리했거나 구매·취소가 선점) → 재시도가 아니라 무부작용 판정이다
     * (S-F, closing I-F 대칭). 행 락 하 재검증이 앞서므로 정상 경로에서 항상 1행이며, 0행이면 호출 측이 롤백한다.
     *
     * @return 영향 행 수(1=전이 성공, 0=이미 종결)
     */
    @Modifying
    @Query("UPDATE Shop s SET s.status = com.finalcall.domain.shop.entity.ShopStatus.EXPIRED "
        + "WHERE s.id = :id "
        + "AND s.status = com.finalcall.domain.shop.entity.ShopStatus.ACTIVE "
        + "AND s.endAt IS NOT NULL AND s.endAt <= :now")
    int markShopExpiredIfExpirable(@Param("id") Long id, @Param("now") Instant now);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default Shop findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
