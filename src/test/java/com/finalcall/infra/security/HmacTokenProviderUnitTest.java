package com.finalcall.infra.security;

import com.finalcall.infra.config.JwtProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * {@link HmacTokenProvider} 단위 테스트(Stage F2) — 스프링 컨텍스트 없이 순수 객체 검증(가장 빠른 계층).
 */
class HmacTokenProviderUnitTest {

    // HS256 은 최소 256비트(32바이트) secret 필요.
    private final HmacTokenProvider tokenProvider = new HmacTokenProvider(
            new JwtProperties("unit-test-secret-key-that-is-at-least-32-bytes-long!!", 30, "HS256"));

    @Test
    void 생성한_토큰을_검증하면_주체를_돌려준다() {
        String token = tokenProvider.generateToken("user-1");

        assertThat(tokenProvider.validateAndGetSubject(token)).isEqualTo("user-1");
    }

    @Test
    void 위조_토큰은_검증에서_예외() {
        assertThatThrownBy(() -> tokenProvider.validateAndGetSubject("not.a.valid.token"))
                .isInstanceOf(Exception.class);
    }
}
