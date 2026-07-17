package com.finalcall.domain.member;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.infra.config.JpaConfig;
import com.finalcall.support.TestcontainersConfiguration;

import jakarta.persistence.EntityManager;

/**
 * 잔액 원자적 증감(D-008) 슬라이스 테스트(member) — 조건부 {@code @Modifying} UPDATE 의 <b>영향행 수 시맨틱</b>과
 * 경계(정확히 잔액/가용/홀드만큼 성공, 1 초과 실패)를 단건(단일 트랜잭션) 관점에서 검증한다.
 *
 * <p>★ {@code @AutoConfigureTestDatabase(replace = NONE)} 로 실제 MySQL(Testcontainers)을 써야 조건부 UPDATE 의
 * {@code WHERE} 절 평가·행수 반환이 실제 DB 문법으로 검증된다. 동시성(경합) 검증은
 * {@code UserBalanceConcurrencyIntegrationTest} 가 병렬로 담당한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, JpaConfig.class})
class UserBalanceRepositorySliceTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private EntityManager em;

    @Test
    void 캐시_차감은_잔액_이내에서만_성공하고_영향행수로_판별된다() {
        Long userId = seed(1000L, 0L, 0L);

        assertThat(userBalanceRepository.decreaseCash(userId, 1000L)).isEqualTo(1); // 정확히 잔액만큼 성공
        assertThat(reload(userId).getCashBalance()).isZero();

        assertThat(userBalanceRepository.decreaseCash(userId, 1L)).isZero(); // 1 초과 → 영향행 0(실패)
        assertThat(reload(userId).getCashBalance()).isZero(); // 실패 시 미변경(음수 없음)
    }

    @Test
    void 게임머니_지급은_선행조건_없이_증가한다() {
        Long userId = seed(0L, 500L, 0L);

        assertThat(userBalanceRepository.increaseGameMoney(userId, 300L)).isEqualTo(1);
        assertThat(reload(userId).getGameMoneyBalance()).isEqualTo(800L);
    }

    @Test
    void 게임머니_차감은_가용_이내에서만_성공한다() {
        Long userId = seed(0L, 1000L, 400L); // 가용 = 600

        assertThat(userBalanceRepository.decreaseGameMoney(userId, 600L)).isEqualTo(1); // 가용 전액
        assertThat(reload(userId).getGameMoneyBalance()).isEqualTo(400L); // 홀드분(400)은 보존

        assertThat(userBalanceRepository.decreaseGameMoney(userId, 1L)).isZero(); // 가용 초과 → 실패
        assertThat(reload(userId).getGameMoneyBalance()).isEqualTo(400L);
    }

    @Test
    void 홀드는_가용_이내에서만_성공하고_초과홀드는_실패한다() {
        Long userId = seed(0L, 1000L, 200L); // 가용 = 800

        assertThat(userBalanceRepository.hold(userId, 800L)).isEqualTo(1); // 가용 전액 홀드
        UserBalance held = reload(userId);
        assertThat(held.getGameMoneyHeld()).isEqualTo(1000L);
        assertThat(held.getGameMoneyAvailable()).isZero();

        assertThat(userBalanceRepository.hold(userId, 1L)).isZero(); // 초과 홀드 → 실패
        assertThat(reload(userId).getGameMoneyHeld()).isEqualTo(1000L);
    }

    @Test
    void 홀드_해제는_보유_홀드_이내에서만_성공한다() {
        Long userId = seed(0L, 1000L, 300L);

        assertThat(userBalanceRepository.release(userId, 300L)).isEqualTo(1); // 보유 홀드 전액 해제
        assertThat(reload(userId).getGameMoneyHeld()).isZero();

        assertThat(userBalanceRepository.release(userId, 1L)).isZero(); // 홀드 초과 해제 → 실패(음수 방지)
        assertThat(reload(userId).getGameMoneyHeld()).isZero();
    }

    /** 잔액 증감은 리포지토리 원자 UPDATE 경로라 엔티티 세터가 없다 → 초기 상태는 리플렉션으로 세팅한다. */
    private Long seed(long cash, long gameMoney, long held) {
        User user = userRepository.save(
            User.builder().loginId("bal").passwordHash("hash").nickname("잔액").build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "cashBalance", cash);
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        ReflectionTestUtils.setField(balance, "gameMoneyHeld", held);
        userBalanceRepository.saveAndFlush(balance);
        em.clear();
        return user.getId();
    }

    private UserBalance reload(Long userId) {
        return userBalanceRepository.findByUserId(userId).orElseThrow();
    }
}
