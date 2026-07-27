package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.finalcall.infra.security.EmailVerificationCodeStore;
import com.finalcall.infra.security.EmailVerificationCodeStore.VerifyOutcome;
import com.finalcall.support.IntegrationTest;

/**
 * {@link EmailVerificationCodeStore} 동작 검증(EPIC-EMAIL-VERIFY, spec §2.3) — 실제 Redis(Testcontainers).
 *
 * <p>발급(issue)·검증(verify)·시도카운트·emailHash 바인딩·쿨다운·clear 를 확인한다. 저장소는 {@code @Component}
 * 가 아니므로 정책값을 주입해 {@code new} 로 직접 생성한다(부팅 없이 독립 검증). Redis 는 롤백되지 않으므로
 * base 의 {@code @AfterEach} flushDb 로 테스트 간 격리한다.
 */
class EmailVerificationCodeStoreIntegrationTest extends IntegrationTest {

    private static final String USER_ID = "1001";
    private static final String EMAIL = "user@naver.com";
    private static final String OTHER_EMAIL = "other@naver.com";
    private static final long TTL_SECONDS = 600;
    private static final long COOLDOWN_SECONDS = 60;
    private static final int MAX_ATTEMPTS = 5;
    private static final int CODE_LENGTH = 6;

    @Autowired
    private StringRedisTemplate redisTemplate;

    private EmailVerificationCodeStore store;

    @BeforeEach
    void setUp() {
        store = newStore(MAX_ATTEMPTS);
    }

    private EmailVerificationCodeStore newStore(int maxAttempts) {
        return new EmailVerificationCodeStore(redisTemplate, TTL_SECONDS, COOLDOWN_SECONDS, maxAttempts, CODE_LENGTH);
    }

    @Test
    void 발급한_코드는_검증에_성공한다() {
        String code = store.issue(USER_ID, EMAIL).orElseThrow();

        assertThat(code).matches("\\d{6}");
        assertThat(store.verify(USER_ID, code, EMAIL)).isEqualTo(VerifyOutcome.SUCCESS);
        // 성공 시 코드 키가 삭제된다(1회성).
        assertThat(redisTemplate.hasKey("auth:email:verify:" + USER_ID)).isFalse();
    }

    @Test
    void 발급시_코드_만료_TTL이_설정된다() {
        store.issue(USER_ID, EMAIL).orElseThrow();

        Long ttl = redisTemplate.getExpire("auth:email:verify:" + USER_ID, TimeUnit.SECONDS);
        assertThat(ttl).isNotNull();
        assertThat(ttl).isBetween(TTL_SECONDS - 5, TTL_SECONDS);
        Long cooldownTtl = redisTemplate.getExpire("auth:email:verify:cd:" + USER_ID, TimeUnit.SECONDS);
        assertThat(cooldownTtl).isBetween(COOLDOWN_SECONDS - 5, COOLDOWN_SECONDS);
    }

    @Test
    void 오입력은_attempts를_증가시키고_상한_초과시_코드를_폐기한다() {
        String code = store.issue(USER_ID, EMAIL).orElseThrow();
        String wrong = wrongCode(code);

        // 5회(maxAttempts)까지는 불일치로 카운트만 증가.
        for (int i = 0; i < MAX_ATTEMPTS; i++) {
            assertThat(store.verify(USER_ID, wrong, EMAIL)).isEqualTo(VerifyOutcome.MISMATCH);
        }
        // 6회째: attempts+1 > 상한 → 초과·코드 폐기(키 삭제).
        assertThat(store.verify(USER_ID, wrong, EMAIL)).isEqualTo(VerifyOutcome.ATTEMPTS_EXCEEDED);
        assertThat(redisTemplate.hasKey("auth:email:verify:" + USER_ID)).isFalse();
        // 폐기 후엔 올바른 코드도 만료로 통일(코드가 사라졌으므로).
        assertThat(store.verify(USER_ID, code, EMAIL)).isEqualTo(VerifyOutcome.EXPIRED);
    }

    @Test
    void 상한_내_올바른_코드는_오입력_후에도_성공한다() {
        String code = store.issue(USER_ID, EMAIL).orElseThrow();
        String wrong = wrongCode(code);

        // 4회 오입력(상한 5 미만) 후 올바른 코드는 성공해야 한다.
        for (int i = 0; i < MAX_ATTEMPTS - 1; i++) {
            assertThat(store.verify(USER_ID, wrong, EMAIL)).isEqualTo(VerifyOutcome.MISMATCH);
        }
        assertThat(store.verify(USER_ID, code, EMAIL)).isEqualTo(VerifyOutcome.SUCCESS);
    }

    @Test
    void 동시_검증에도_시도카운트_누수가_없다_c() throws Exception {
        // c: 상한을 크게 잡아 모든 병렬 오입력이 MISMATCH 로 카운트되게 하고, 최종 attempts 가 정확히 N 인지 확인.
        int threads = 16;
        EmailVerificationCodeStore highLimit = newStore(1000);
        String code = highLimit.issue(USER_ID, EMAIL).orElseThrow();
        String wrong = wrongCode(code);

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger mismatches = new AtomicInteger();
        try {
            for (int i = 0; i < threads; i++) {
                pool.submit(() -> {
                    try {
                        ready.await();
                        if (highLimit.verify(USER_ID, wrong, EMAIL) == VerifyOutcome.MISMATCH) {
                            mismatches.incrementAndGet();
                        }
                    } catch (InterruptedException ex) {
                        Thread.currentThread().interrupt();
                    } finally {
                        done.countDown();
                    }
                });
            }
            ready.countDown(); // 동시 출발
            assertThat(done.await(10, TimeUnit.SECONDS)).isTrue();
        } finally {
            pool.shutdownNow();
        }

        assertThat(mismatches.get()).isEqualTo(threads); // 모두 불일치(누수 없음)
        Object attempts = redisTemplate.opsForHash().get("auth:email:verify:" + USER_ID, "attempts");
        assertThat(Integer.parseInt(String.valueOf(attempts))).isEqualTo(threads); // Lua HINCRBY 원자 → 정확히 N
    }

    @Test
    void 다른_이메일로_검증하면_만료로_통일하고_코드를_폐기한다_d() {
        // d: 발송 시점 이메일과 현재 이메일이 다르면(변경 후) 옛 코드가 새 이메일을 인증하지 못한다(emailHash 바인딩).
        String code = store.issue(USER_ID, EMAIL).orElseThrow();

        assertThat(store.verify(USER_ID, code, OTHER_EMAIL)).isEqualTo(VerifyOutcome.EXPIRED);
        // emailHash 불일치는 존재를 노출하지 않기 위해 키를 삭제한다.
        assertThat(redisTemplate.hasKey("auth:email:verify:" + USER_ID)).isFalse();
        // 키가 사라졌으므로 원래 이메일로 재검증해도 만료.
        assertThat(store.verify(USER_ID, code, EMAIL)).isEqualTo(VerifyOutcome.EXPIRED);
    }

    @Test
    void 쿨다운_내_연속_발송은_거부된다_e() {
        assertThat(store.issue(USER_ID, EMAIL)).isPresent();

        // 쿨다운 키가 살아 있으므로 두 번째 발송은 코드 미생성(empty).
        Optional<String> second = store.issue(USER_ID, EMAIL);
        assertThat(second).isEmpty();
    }

    @Test
    void clear_후_검증은_만료다_f() {
        String code = store.issue(USER_ID, EMAIL).orElseThrow();

        store.clear(USER_ID);

        assertThat(store.verify(USER_ID, code, EMAIL)).isEqualTo(VerifyOutcome.EXPIRED);
        // 쿨다운 키도 삭제되어 즉시 재발송 가능.
        assertThat(store.issue(USER_ID, EMAIL)).isPresent();
    }

    @Test
    void 미발송_상태_검증은_만료다() {
        assertThat(store.verify(USER_ID, "123456", EMAIL)).isEqualTo(VerifyOutcome.EXPIRED);
    }

    /** 주어진 코드와 확실히 다른 6자리 코드를 만든다(우연 일치로 SUCCESS 가 되지 않도록). */
    private static String wrongCode(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }
}
