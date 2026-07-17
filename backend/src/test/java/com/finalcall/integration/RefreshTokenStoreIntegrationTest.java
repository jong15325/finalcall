package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.finalcall.infra.config.JwtProperties;
import com.finalcall.infra.security.RefreshTokenStore;
import com.finalcall.support.IntegrationTest;

/**
 * {@link RefreshTokenStore} 동작 검증(auth, B-011) — 실제 Redis(Testcontainers).
 *
 * <p>회전(rotate)·재사용 탐지(detectReuse)·만료(TTL)·폐기(revoke)를 확인한다.
 * Redis 는 롤백되지 않으므로 base 의 @AfterEach flushDb 로 테스트 간 격리한다.
 */
class RefreshTokenStoreIntegrationTest extends IntegrationTest {

    private static final String USER_ID = "1001";

    @Autowired
    private RefreshTokenStore refreshTokenStore;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private JwtProperties jwtProperties;

    @Test
    void 발급한_토큰은_검증에_성공한다() {
        String token = refreshTokenStore.issue(USER_ID);

        assertThat(refreshTokenStore.validate(token)).contains(USER_ID);
    }

    @Test
    void 발급시_refresh_만료_TTL이_설정된다() {
        String token = refreshTokenStore.issue(USER_ID);

        Long ttlSeconds = redisTemplate.getExpire(keyOf(token), TimeUnit.SECONDS);
        long expected = jwtProperties.refreshExpDays() * 24 * 60 * 60;
        // TTL 이 설정됐고(영구 아님) refresh 만료값 근처인지 확인.
        assertThat(ttlSeconds).isNotNull();
        assertThat(ttlSeconds).isBetween(expected - 60, expected);
    }

    @Test
    void 회전하면_같은_세션에_신규_토큰이_발급된다() {
        String original = refreshTokenStore.issue(USER_ID);

        Optional<RefreshTokenStore.Rotation> rotated = refreshTokenStore.rotate(original);

        assertThat(rotated).isPresent();
        assertThat(rotated.get().refreshToken()).isNotEqualTo(original);
        assertThat(rotated.get().userId()).isEqualTo(USER_ID);
        // 신규 토큰은 유효(같은 세션 키 유지 — 라우팅 정보 동일).
        assertThat(refreshTokenStore.validate(rotated.get().refreshToken())).contains(USER_ID);
        assertThat(keyOf(rotated.get().refreshToken())).isEqualTo(keyOf(original));
    }

    @Test
    void 회전으로_폐기된_옛_토큰_재사용시_세션이_무효화된다() {
        String original = refreshTokenStore.issue(USER_ID);
        String rotated = refreshTokenStore.rotate(original).orElseThrow().refreshToken();

        // 폐기된 옛 토큰 재사용 → 무효 + 재사용 탐지로 세션 자체 무효화.
        assertThat(refreshTokenStore.validate(original)).isEmpty();
        // 세션이 무효화되어 방금 회전한 신규 토큰도 더 이상 유효하지 않다(탈취 대응).
        assertThat(refreshTokenStore.validate(rotated)).isEmpty();
        assertThat(redisTemplate.hasKey(keyOf(original))).isFalse();
    }

    @Test
    void 폐기하면_검증에_실패한다() {
        String token = refreshTokenStore.issue(USER_ID);

        refreshTokenStore.revoke(token, USER_ID);

        assertThat(refreshTokenStore.validate(token)).isEmpty();
    }

    @Test
    void 소유자가_아니면_폐기되지_않는다() {
        String token = refreshTokenStore.issue(USER_ID);

        refreshTokenStore.revoke(token, "9999"); // 타 사용자 → no-op

        assertThat(refreshTokenStore.validate(token)).contains(USER_ID);
    }

    @Test
    void 일괄_폐기하면_사용자의_모든_세션이_무효화된다() {
        String s1 = refreshTokenStore.issue(USER_ID);
        String s2 = refreshTokenStore.issue(USER_ID);
        String s3 = refreshTokenStore.issue(USER_ID);

        refreshTokenStore.revokeAll(USER_ID);

        assertThat(refreshTokenStore.validate(s1)).isEmpty();
        assertThat(refreshTokenStore.validate(s2)).isEmpty();
        assertThat(refreshTokenStore.validate(s3)).isEmpty();
    }

    @Test
    void 일괄_폐기는_타_사용자_세션에_영향을_주지_않는다() {
        String mine = refreshTokenStore.issue(USER_ID);
        String other = refreshTokenStore.issue("2002");

        refreshTokenStore.revokeAll(USER_ID);

        assertThat(refreshTokenStore.validate(mine)).isEmpty();
        assertThat(refreshTokenStore.validate(other)).contains("2002");
    }

    @Test
    void 세션이_없는_사용자를_일괄_폐기해도_오류가_없다_멱등() {
        refreshTokenStore.revokeAll(USER_ID); // 세션 없음 → no-op
        refreshTokenStore.revokeAll(USER_ID); // 반복 호출도 안전

        assertThat(redisTemplate.hasKey("auth:refresh:" + USER_ID + ":dummy")).isFalse();
    }

    @Test
    void 형식이_잘못된_토큰은_무효다() {
        assertThat(refreshTokenStore.validate("garbage")).isEmpty();
        assertThat(refreshTokenStore.rotate("a.b")).isEmpty();
    }

    @Test
    void 동일_refresh_동시_회전은_단일_승자이고_세션이_무효화된다_m2() throws Exception {
        // m2: 같은 토큰을 N스레드가 동시에 rotate → Lua CAS 로 정확히 1개만 OK, 나머지는 재사용 탐지로 empty.
        // 패자들이 세션을 삭제(REUSE)하므로 종국엔 세션 키가 사라진다(단일 승자·회귀 방지).
        String original = refreshTokenStore.issue(USER_ID);

        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger winners = new AtomicInteger();
        try {
            for (int i = 0; i < threads; i++) {
                pool.submit(() -> {
                    try {
                        ready.await();
                        if (refreshTokenStore.rotate(original).isPresent()) {
                            winners.incrementAndGet();
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

        assertThat(winners.get()).isEqualTo(1); // 단일 승자
        assertThat(redisTemplate.hasKey(keyOf(original))).isFalse(); // 패자 재사용 탐지 → 세션 무효화
    }

    /** 원문 토큰({@code userId.sessionId.secret})에서 Redis 세션 키를 유도한다(테스트 검증용). */
    private static String keyOf(String token) {
        String[] parts = token.split("\\.", -1);
        return "auth:refresh:" + parts[0] + ":" + parts[1];
    }
}
