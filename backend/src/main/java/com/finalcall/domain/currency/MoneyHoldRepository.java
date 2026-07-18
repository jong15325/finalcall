package com.finalcall.domain.currency;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;

/**
 * 홀드 원장 리포지토리(currency).
 *
 * <p>상태 전이는 조건부 {@code @Modifying} UPDATE 로만 수행한다(D-008). {@code WHERE status='HELD'} 를 DB 행
 * 락 아래에서 평가하므로 <b>이중 해제가 성립하지 않고</b>, 영향행 0 이 곧 "이미 해제·차감됨"이라는 판정이다.
 *
 * <p><b>{@code clearAutomatically} 를 붙이지 않는다</b> — 영속성 컨텍스트를 통째로 비우면 호출 측 관리 엔티티가
 * detach 되어 이후 갱신이 조용히 유실된다(bid-domain-spec §4.2 함정의 확산 방지).
 */
public interface MoneyHoldRepository extends JpaRepository<MoneyHold, Long> {

    /**
     * 입찰에 대응하는 <b>유효 홀드</b>(HELD)를 값 스냅샷으로 조회한다. {@code bid_id} UK 라 최대 1건이다.
     *
     * <p>해제액을 호출 인자로 받지 않고 여기서 읽는 이유: 잔액 해제액이 원장의 홀드액과 갈라지면
     * {@code game_money_held} 와 원장 합계가 어긋난다(I4). 원장을 단일 진실원으로 삼아 그 경로를 없앤다.
     *
     * @return HELD 홀드 스냅샷. 없거나 이미 RELEASED/CAPTURED 면 비어 있다
     */
    @Query("SELECT new com.finalcall.domain.currency.MoneyHoldSnapshot(h.id, h.user.id, h.amount) FROM MoneyHold h "
        + "WHERE h.bid.id = :bidId "
        + "AND h.status = com.finalcall.domain.currency.MoneyHoldStatus.HELD")
    Optional<MoneyHoldSnapshot> findHeldByBidId(@Param("bidId") Long bidId);

    /**
     * 홀드 해제 조건부 CAS(P-008). HELD 일 때만 RELEASED 로 전이하며 해제 시각을 남긴다.
     *
     * <p>영향행이 0이면 이미 해제·차감된 홀드를 다시 해제하려 한 것이므로 <b>불변식 위반</b>이다 — 호출 측은
     * 무시하지 않고 예외로 올려 트랜잭션 전체를 롤백해야 한다(이중 해제 = 무자본 입찰).
     *
     * @return 영향 행 수(1=해제 성공, 0=대상이 HELD 가 아님)
     */
    @Modifying
    @Query("UPDATE MoneyHold h "
        + "SET h.status = com.finalcall.domain.currency.MoneyHoldStatus.RELEASED, h.releasedAt = :releasedAt "
        + "WHERE h.id = :holdId "
        + "AND h.status = com.finalcall.domain.currency.MoneyHoldStatus.HELD")
    int releaseIfHeld(@Param("holdId") Long holdId, @Param("releasedAt") Instant releasedAt);

    /** OrThrow default 메서드 패턴 — 없으면 {@link BusinessException}(CLAUDE.md §5). */
    default MoneyHold findByIdOrThrow(Long id, ErrorCode errorCode) {
        return findById(id).orElseThrow(() -> new BusinessException(errorCode));
    }
}
