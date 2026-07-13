package com.finalcall.integration;

import com.finalcall.infra.config.JwtProperties;
import com.finalcall.infra.security.RefreshTokenStore;
import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

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

        Optional<String> rotated = refreshTokenStore.rotate(original);

        assertThat(rotated).isPresent();
        assertThat(rotated.get()).isNotEqualTo(original);
        // 신규 토큰은 유효(같은 세션 키 유지 — 라우팅 정보 동일).
        assertThat(refreshTokenStore.validate(rotated.get())).contains(USER_ID);
        assertThat(keyOf(rotated.get())).isEqualTo(keyOf(original));
    }

    @Test
    void 회전으로_폐기된_옛_토큰_재사용시_세션이_무효화된다() {
        String original = refreshTokenStore.issue(USER_ID);
        String rotated = refreshTokenStore.rotate(original).orElseThrow();

        // 폐기된 옛 토큰 재사용 → 무효 + 재사용 탐지로 세션 자체 무효화.
        assertThat(refreshTokenStore.validate(original)).isEmpty();
        // 세션이 무효화되어 방금 회전한 신규 토큰도 더 이상 유효하지 않다(탈취 대응).
        assertThat(refreshTokenStore.validate(rotated)).isEmpty();
        assertThat(redisTemplate.hasKey(keyOf(original))).isFalse();
    }

    @Test
    void 폐기하면_검증에_실패한다() {
        String token = refreshTokenStore.issue(USER_ID);

        refreshTokenStore.revoke(token);

        assertThat(refreshTokenStore.validate(token)).isEmpty();
    }

    @Test
    void 형식이_잘못된_토큰은_무효다() {
        assertThat(refreshTokenStore.validate("garbage")).isEmpty();
        assertThat(refreshTokenStore.rotate("a.b")).isEmpty();
    }

    /** 원문 토큰({@code userId.sessionId.secret})에서 Redis 세션 키를 유도한다(테스트 검증용). */
    private static String keyOf(String token) {
        String[] parts = token.split("\\.", -1);
        return "auth:refresh:" + parts[0] + ":" + parts[1];
    }
}
