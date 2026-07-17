package com.finalcall.domain.member;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자 잔액 리포지토리(member). 가입 시 {@link User} 와 1:1 잔액 행을 함께 생성한다.
 *
 * <p><b>원자적 증감(D-008):</b> 잔액 갱신은 엔티티 dirty-checking 이 아니라 조건부 {@code @Modifying} UPDATE 로
 * 수행한다. 각 UPDATE 는 선행조건(음수 방지·가용/홀드 이내)을 {@code WHERE} 절에 담아 DB 행 락 아래에서
 * 원자적으로 평가하므로, 마감 직전 폭주 시 read-modify-write 경합(이중 차감·초과 홀드·음수 잔액)이 발생하지 않는다.
 * 반환값은 <b>영향행 수</b>다: 1 이면 성공, 0 이면 선행조건 위반(잔액 부족 등)이며 호출측이 실패로 매핑한다.
 * {@code clearAutomatically}/{@code flushAutomatically} 로 벌크 UPDATE 전후 영속성 컨텍스트를 정합화한다.
 */
public interface UserBalanceRepository extends JpaRepository<UserBalance, Long> {

    /** 사용자 PK로 잔액 행 조회(내 잔액 조회, 계약 [4.4]). user_id 는 UK+FK 라 최대 1건. */
    Optional<UserBalance> findByUserId(Long userId);

    /**
     * 캐시 차감(계약 §4.4 교환 출금 등). 잔액 이상 차감은 실패(음수 방지).
     *
     * @return 영향행 수 — 1 성공, 0 캐시 잔액 부족(EXC_001 등으로 매핑)
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserBalance b SET b.cashBalance = b.cashBalance - :amount "
        + "WHERE b.user.id = :userId AND b.cashBalance >= :amount")
    int decreaseCash(@Param("userId") Long userId, @Param("amount") long amount);

    /**
     * 게임머니 지급(계약 §4.4 교환 입금 등). 증가만 하므로 선행조건 없이 항상 성공한다.
     *
     * @return 영향행 수 — 대상 잔액 행이 있으면 1
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserBalance b SET b.gameMoneyBalance = b.gameMoneyBalance + :amount "
        + "WHERE b.user.id = :userId")
    int increaseGameMoney(@Param("userId") Long userId, @Param("amount") long amount);

    /**
     * 게임머니 차감. 가용(= 잔액 − 홀드) 이내에서만 성공한다 — 홀드(에스크로)로 묶인 금액은 침범하지 않으며,
     * 가용 이내 보장은 잔액 음수 방지도 함께 만족한다(홀드 ≥ 0 이므로 가용 ≤ 잔액).
     *
     * @return 영향행 수 — 1 성공, 0 가용 게임머니 부족
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserBalance b SET b.gameMoneyBalance = b.gameMoneyBalance - :amount "
        + "WHERE b.user.id = :userId AND b.gameMoneyBalance - b.gameMoneyHeld >= :amount")
    int decreaseGameMoney(@Param("userId") Long userId, @Param("amount") long amount);

    /**
     * 게임머니 홀드(에스크로 잠금, 입찰). 가용(= 잔액 − 홀드) 이내에서만 성공한다(초과 홀드 방지).
     *
     * @return 영향행 수 — 1 성공, 0 가용 게임머니 부족
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserBalance b SET b.gameMoneyHeld = b.gameMoneyHeld + :amount "
        + "WHERE b.user.id = :userId AND b.gameMoneyBalance - b.gameMoneyHeld >= :amount")
    int hold(@Param("userId") Long userId, @Param("amount") long amount);

    /**
     * 게임머니 홀드 해제. 현재 홀드 이내에서만 성공한다(음수 홀드 방지).
     *
     * @return 영향행 수 — 1 성공, 0 홀드 초과 해제 시도
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE UserBalance b SET b.gameMoneyHeld = b.gameMoneyHeld - :amount "
        + "WHERE b.user.id = :userId AND b.gameMoneyHeld >= :amount")
    int release(@Param("userId") Long userId, @Param("amount") long amount);
}
