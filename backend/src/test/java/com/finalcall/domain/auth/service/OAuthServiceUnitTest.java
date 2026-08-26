package com.finalcall.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.auth.dto.TokenBundle;
import com.finalcall.domain.auth.service.OAuthMetrics.Result;
import com.finalcall.domain.member.entity.SocialProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.service.SocialAccountService;
import com.finalcall.infra.security.RefreshTokenStore;

/**
 * {@link OAuthService} 단위 테스트(auth, FC-154) — provider 전략·find-or-create·토큰 발급을 모의해
 * 오케스트레이션만 검증한다(HTTP 는 전략 테스트가 담당).
 *
 * <p>성공 흐름(교환→find-or-create→토큰 발급, {@code AuthService.login} 동일 조립)과 미지원 provider(AUTH_006)를 덮는다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuthServiceUnitTest {

    @Mock
    private OAuthProviderStrategy naverStrategy;

    @Mock
    private SocialAccountService socialAccountService;

    @Mock
    private TokenProvider tokenProvider;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    @Mock
    private OAuthMetrics oauthMetrics;

    private OAuthService oauthService() {
        when(naverStrategy.provider()).thenReturn(SocialProvider.NAVER);
        return new OAuthService(List.of(naverStrategy), socialAccountService, tokenProvider, refreshTokenStore,
            oauthMetrics);
    }

    @Test
    void 소셜로그인_성공시_교환_findOrCreate_후_토큰을_발급한다() {
        User user = User.builder().nickname("네이버유저").build();
        ReflectionTestUtils.setField(user, "id", 77L);
        Instant expiresAt = Instant.parse("2026-07-29T00:30:00Z");
        when(naverStrategy.exchange("code-1", "http://localhost:5173/oauth/callback"))
            .thenReturn(new OAuthUserProfile("naver-uid-1", "네이버유저"));
        when(socialAccountService.findOrCreate(SocialProvider.NAVER, "naver-uid-1", "네이버유저"))
            .thenReturn(user);
        when(tokenProvider.generateAccessToken(any(TokenClaims.class))).thenReturn("access-token");
        when(tokenProvider.accessTokenExpiresAt()).thenReturn(expiresAt);
        when(refreshTokenStore.issue("77")).thenReturn("77.sid.secret");

        TokenBundle result = oauthService().login("naver", "code-1", "http://localhost:5173/oauth/callback");

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("77.sid.secret");
        assertThat(result.accessExpiresAt()).isEqualTo(expiresAt);
        verify(refreshTokenStore).issue("77"); // userId 기반 발급(provider 무관, login 재사용)
    }

    @Test
    void provider_경로는_대소문자_무관하게_해석된다() {
        User user = User.builder().nickname("네이버유저").build();
        ReflectionTestUtils.setField(user, "id", 77L);
        when(naverStrategy.exchange(any(), any())).thenReturn(new OAuthUserProfile("uid", "네이버유저"));
        when(socialAccountService.findOrCreate(any(), any(), any())).thenReturn(user);
        when(tokenProvider.generateAccessToken(any())).thenReturn("access-token");
        when(tokenProvider.accessTokenExpiresAt()).thenReturn(Instant.now());
        when(refreshTokenStore.issue(any())).thenReturn("77.sid.secret");

        TokenBundle result = oauthService().login("NAVER", "code-1", "http://localhost:5173/oauth/callback");

        assertThat(result.accessToken()).isEqualTo("access-token");
    }

    @Test
    void 미지원_provider_는_AUTH_006_이고_전략을_호출하지_않는다() {
        OAuthService service = oauthService();

        assertThatThrownBy(() -> service.login("google", "code-1", "http://localhost:5173/oauth/callback"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_UNSUPPORTED_PROVIDER);

        verify(naverStrategy, never()).exchange(any(), any());
        verifyNoInteractions(socialAccountService, tokenProvider, refreshTokenStore);
    }

    @Test
    void 등록되지_않은_provider_카카오_도_AUTH_006() {
        // 전략 목록에 KAKAO 전략을 넣지 않았으므로(naver 만) enum 은 유효하나 전략 부재 → AUTH_006.
        OAuthService service = oauthService();

        assertThatThrownBy(() -> service.login("kakao", "code-1", "http://localhost:5173/oauth/callback"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_UNSUPPORTED_PROVIDER);
    }

    @Test
    void 예상하지_못한_RuntimeException도_고정_result로_계측하고_원예외를_전파한다() {
        RuntimeException failure = new IllegalStateException("민감한 내부 오류 원문");
        when(naverStrategy.exchange("code-1", "http://localhost:5173/oauth/callback"))
            .thenReturn(new OAuthUserProfile("provider-user-id", "네이버유저"));
        when(socialAccountService.findOrCreate(
            SocialProvider.NAVER, "provider-user-id", "네이버유저"))
            .thenThrow(failure);

        assertThatThrownBy(() -> oauthService().login(
            "naver", "code-1", "http://localhost:5173/oauth/callback"))
            .isSameAs(failure);

        verify(oauthMetrics).recordRequest(
            eq(SocialProvider.NAVER), eq(Result.PROVIDER_ERROR), eq(500), anyLong());
    }
}
