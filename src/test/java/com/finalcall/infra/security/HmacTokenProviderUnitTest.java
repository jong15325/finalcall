package com.finalcall.infra.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.finalcall.common.security.TokenClaims;
import com.finalcall.infra.config.JwtProperties;

/**
 * {@link HmacTokenProvider} 단위 테스트(Stage F2, auth 클레임 정합) — 스프링 컨텍스트 없이 순수 객체 검증(가장 빠른 계층).
 */
class HmacTokenProviderUnitTest {

    // HS256 은 최소 256비트(32바이트) secret 필요.
    private final HmacTokenProvider tokenProvider = new HmacTokenProvider(
        new JwtProperties("unit-test-secret-key-that-is-at-least-32-bytes-long!!", 30, 14, "HS256"));

    @Test
    void 생성한_토큰을_파싱하면_클레임을_돌려준다() {
        String token = tokenProvider.generateAccessToken(new TokenClaims("42", "01HXPUBLICID0000000000000A", true));

        TokenClaims claims = tokenProvider.parseAccessToken(token);
        assertThat(claims.userId()).isEqualTo("42");
        assertThat(claims.publicId()).isEqualTo("01HXPUBLICID0000000000000A");
        assertThat(claims.admin()).isTrue();
    }

    @Test
    void 관리자가_아니면_isAdmin_클레임은_false() {
        String token = tokenProvider.generateAccessToken(new TokenClaims("7", "01HXPUBLICID0000000000000B", false));

        assertThat(tokenProvider.parseAccessToken(token).admin()).isFalse();
    }

    @Test
    void 위조_토큰은_파싱에서_예외() {
        assertThatThrownBy(() -> tokenProvider.parseAccessToken("not.a.valid.token"))
            .isInstanceOf(Exception.class);
    }
}
