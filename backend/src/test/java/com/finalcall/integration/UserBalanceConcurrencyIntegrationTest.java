package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.IntSupplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.member.UserBalanceRepository;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.SeedTestSupport;

/**
 * 잔액 원자적 증감(D-008) 동시성 검증(member) — 실제 MySQL(Testcontainers).
 *
 * <p>마감 직전 폭주를 모사해, 가용 이상으로 시도한 병렬 차감/홀드에서 조건부 {@code @Modifying} UPDATE 가
 * <b>이중 차감·초과 홀드·음수 잔액</b>을 허용하지 않음을 단언한다. 각 리포지토리 호출은 자체 트랜잭션으로 커밋되며
 * DB 행 락이 {@code WHERE} 조건을 직렬 평가하므로, 성공 횟수는 정확히 용량(가용/잔액 ÷ 단위)과 일치한다.
 *
 * <p>★ 실제 커밋이 필요해 {@code @Transactional} 을 걸지 않고, 생성 데이터는 {@code @BeforeEach/@AfterEach} 로 정리한다.
 */
class UserBalanceConcurrencyIntegrationTest extends IntegrationTest {

    private static final int UNIT = 100;
    private static final int CAPACITY = 50; // 성공 가능 횟수(가용/잔액 ÷ 단위)
    private static final int THREADS = 80; // 시도 횟수(용량 초과) → 초과분은 반드시 실패해야 한다

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @BeforeEach
    @AfterEach
    void clean() {
        // V9 시드 user(item FK 참조)는 보존하고 테스트가 만든 user·잔액만 정리한다.
        SeedTestSupport.deleteNonSeedUsers(userRepository, userBalanceRepository);
    }

    @Test
    void 병렬_캐시차감은_잔액을_초과하지_않고_이중차감_없이_정확히_소진된다() throws Exception {
        Long userId = seed((long)UNIT * CAPACITY, 0L, 0L); // 캐시 = 5000

        Result result = hammer(() -> userBalanceRepository.decreaseCash(userId, UNIT));

        assertThat(result.success).isEqualTo(CAPACITY); // 정확히 용량만큼만 성공(이중 차감 없음)
        assertThat(result.fail).isEqualTo(THREADS - CAPACITY); // 초과분은 영향행 0
        assertThat(reload(userId).getCashBalance()).isZero(); // 정확히 소진 — 음수 없음
    }

    @Test
    void 병렬_홀드는_가용을_초과하지_않고_초과홀드_없이_정확히_찬다() throws Exception {
        Long userId = seed(0L, (long)UNIT * CAPACITY, 0L); // 게임머니 잔액 = 5000, 홀드 0(가용 5000)

        Result result = hammer(() -> userBalanceRepository.hold(userId, UNIT));

        assertThat(result.success).isEqualTo(CAPACITY);
        assertThat(result.fail).isEqualTo(THREADS - CAPACITY);
        UserBalance after = reload(userId);
        assertThat(after.getGameMoneyHeld()).isEqualTo((long)UNIT * CAPACITY); // 가용만큼만 홀드
        assertThat(after.getGameMoneyBalance()).isEqualTo((long)UNIT * CAPACITY); // 잔액 불변
        assertThat(after.getGameMoneyAvailable()).isZero(); // 초과 홀드 없음 — 가용 음수 아님
    }

    /** {@code op} 를 THREADS 개 스레드로 동시에 실행하고, 영향행 1(성공)/0(실패) 횟수를 집계한다. */
    private Result hammer(IntSupplier op) throws InterruptedException {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger fail = new AtomicInteger();
        try {
            for (int i = 0; i < THREADS; i++) {
                pool.submit(() -> {
                    try {
                        ready.await();
                        if (op.getAsInt() == 1) {
                            success.incrementAndGet();
                        } else {
                            fail.incrementAndGet();
                        }
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            ready.countDown(); // 일제 시작
            assertThat(done.await(20, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }
        return new Result(success.get(), fail.get());
    }

    /** 잔액 증감은 리포지토리 원자 UPDATE 경로라 엔티티 세터가 없다 → 초기 상태는 리플렉션으로 세팅한다. */
    private Long seed(long cash, long gameMoney, long held) {
        User user = userRepository.save(
            User.builder().loginId("racer").passwordHash("hash").nickname("잔액경합").build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "cashBalance", cash);
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        ReflectionTestUtils.setField(balance, "gameMoneyHeld", held);
        userBalanceRepository.save(balance);
        return user.getId();
    }

    private UserBalance reload(Long userId) {
        return userBalanceRepository.findByUserId(userId).orElseThrow();
    }

    private record Result(int success, int fail) {
    }
}
