package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.domain.currency.ExchangeProperties;
import com.finalcall.domain.currency.entity.ExchangeDirection;
import com.finalcall.domain.currency.entity.MoneyExchange;
import com.finalcall.domain.currency.repository.MoneyExchangeRepository;
import com.finalcall.domain.currency.service.ExchangeService;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.SeedTestSupport;

/**
 * 교환 멱등성 동시 경쟁 검증(currency, FC-009) — 실제 MySQL(Testcontainers).
 *
 * <p>같은 {@code (userId, key)} 로 여러 요청이 동시에 도착하면(선검사를 함께 통과) {@code (user_id, idempotency_key)}
 * UK 가 하나만 커밋시키고, 진 트랜잭션은 캐시 차감까지 통째로 롤백된다 — <b>캐시 이중 차감이 없고</b>, 진 쪽도
 * 오류가 아니라 승자의 최초 결과를 그대로 반환함을 단언한다(SEC-004 불변식 1·2).
 *
 * <p>★ 실제 커밋·독립 트랜잭션이 필요해 {@code @Transactional} 을 걸지 않고, 데이터는 수동 정리한다.
 * 서비스는 SecurityContext 로 주체를 읽으므로 각 스레드에서 컨텍스트를 세팅한다.
 */
class ExchangeConcurrencyIntegrationTest extends IntegrationTest {

    private static final long AMOUNT = 1_000L;
    private static final int THREADS = 8;
    private static final String KEY = "concurrent-key";

    @Autowired
    private ExchangeService exchangeService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    @Autowired
    private MoneyExchangeRepository moneyExchangeRepository;

    @Autowired
    private ExchangeProperties exchangeProperties;

    @BeforeEach
    @AfterEach
    void clean() {
        moneyExchangeRepository.deleteAllInBatch();
        // V9 시드 user(item FK 참조)는 보존하고 테스트가 만든 user·잔액만 정리한다.
        SeedTestSupport.deleteNonSeedUsers(userRepository, userBalanceRepository);
    }

    @Test
    void 같은키_동시제출은_이중차감없이_한번만_처리되고_모두_승자결과를_받는다() throws Exception {
        long rate = exchangeProperties.rate();
        Long userId = seedCash(AMOUNT * THREADS); // 이중 차감이 있었다면 성립 못 하도록 넉넉히 준다

        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(THREADS);
        AtomicInteger ok = new AtomicInteger();
        AtomicInteger error = new AtomicInteger();
        AtomicReference<Long> gameMoneySeen = new AtomicReference<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                pool.submit(() -> {
                    authenticateAs(userId);
                    try {
                        ready.await();
                        MoneyExchange result = exchangeService.exchange(ExchangeDirection.CASH_TO_GAME, AMOUNT, KEY);
                        gameMoneySeen.set(result.getGameMoneyAmount()); // 모든 스레드가 같은 값을 봐야 한다
                        ok.incrementAndGet();
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } catch (RuntimeException ex) {
                        error.incrementAndGet();
                    } finally {
                        SecurityContextHolder.clearContext();
                        done.countDown();
                    }
                });
            }
            ready.countDown(); // 일제 시작
            assertThat(done.await(20, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        // 모든 요청이 오류 없이 승자 결과를 반환한다(진 쪽도 예외 아님).
        assertThat(ok.get()).isEqualTo(THREADS);
        assertThat(error.get()).isZero();
        assertThat(gameMoneySeen.get()).isEqualTo(AMOUNT * rate);

        // UK 가 하나만 통과 → 원장 1건, 캐시는 딱 한 번만 차감(이중 차감 없음).
        assertThat(moneyExchangeRepository.count()).isEqualTo(1);
        UserBalance balance = userBalanceRepository.findByUserId(userId).orElseThrow();
        assertThat(balance.getCashBalance()).isEqualTo(AMOUNT * THREADS - AMOUNT);
        assertThat(balance.getGameMoneyBalance()).isEqualTo(AMOUNT * rate);
    }

    private void authenticateAs(Long userId) {
        SecurityContextHolder.setContext(new SecurityContextImpl(
            new UsernamePasswordAuthenticationToken(String.valueOf(userId), null, List.of())));
    }

    private Long seedCash(long cash) {
        User user = userRepository.save(
            User.builder().loginId("racer").passwordHash("hash").nickname("교환경합").build());
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "cashBalance", cash);
        userBalanceRepository.save(balance);
        return user.getId();
    }
}
