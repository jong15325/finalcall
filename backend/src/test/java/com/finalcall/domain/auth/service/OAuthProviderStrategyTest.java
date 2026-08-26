package com.finalcall.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.domain.auth.config.OAuthProperties;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * OAuth provider 전략의 토큰 교환·userinfo 파싱·오류 매핑 검증(auth, FC-154). provider HTTP 는
 * {@link MockRestServiceServer} 로 스텁해 라이브 키 없이 검증한다(RestClient 목).
 *
 * <p>공통 골격({@link AbstractOAuthProviderStrategy})의 오류 매핑(4xx→AUTH_007, 5xx→AUTH_008, redirectUri
 * 화이트리스트 위반→400)과 provider별 userinfo 파싱(네이버 {@code response.*}·카카오 {@code kakao_account.*})을 함께 덮는다.
 */
class OAuthProviderStrategyTest {

    private static final String TOKEN_URI = "https://token.test/oauth/token";
    private static final String USERINFO_URI = "https://userinfo.test/me";
    private static final String REDIRECT_URI = "http://localhost:5173/oauth/callback";
    private final OAuthMetrics oauthMetrics = new OAuthMetrics(new SimpleMeterRegistry());

    private OAuthProperties propertiesWith(String tokenUri, String userinfoUri) {
        OAuthProperties.Provider provider = new OAuthProperties.Provider(
            "client-id", "client-secret", REDIRECT_URI, tokenUri, userinfoUri);
        return new OAuthProperties(provider, provider);
    }

    private RestClient bindMockServer(RestClient.Builder builder, MockRestServiceServer[] holder) {
        holder[0] = MockRestServiceServer.bindTo(builder).build();
        return builder.build();
    }

    @Test
    void 네이버_토큰교환_userinfo_성공시_프로필을_추출한다() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"naver-at\"}", MediaType.APPLICATION_JSON));
        server[0].expect(requestTo(USERINFO_URI)).andExpect(method(HttpMethod.GET))
            .andExpect(header("Authorization", "Bearer naver-at"))
            .andRespond(withSuccess(
                "{\"response\":{\"id\":\"naver-uid-1\",\"nickname\":\"네이버유저\"}}", MediaType.APPLICATION_JSON));

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);
        OAuthUserProfile profile = strategy.exchange("code-1", REDIRECT_URI);

        assertThat(profile.providerUserId()).isEqualTo("naver-uid-1");
        assertThat(profile.nickname()).isEqualTo("네이버유저");
        server[0].verify();
    }

    @Test
    void 카카오_userinfo_는_kakao_account_profile_에서_닉네임을_읽는다() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"kakao-at\"}", MediaType.APPLICATION_JSON));
        server[0].expect(requestTo(USERINFO_URI)).andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess(
                "{\"id\":9876,\"kakao_account\":{\"profile\":{\"nickname\":\"카카오유저\"}}}",
                MediaType.APPLICATION_JSON));

        KakaoOAuthStrategy strategy = new KakaoOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);
        OAuthUserProfile profile = strategy.exchange("code-1", REDIRECT_URI);

        assertThat(profile.providerUserId()).isEqualTo("9876"); // 숫자 회원번호 → 문자열
        assertThat(profile.nickname()).isEqualTo("카카오유저");
        server[0].verify();
    }

    @Test
    void 토큰교환_4xx_는_AUTH_007() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withStatus(HttpStatus.UNAUTHORIZED)); // 무효·만료·재사용 코드

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("bad-code", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_EXCHANGE_FAILED);
    }

    @Test
    void 토큰교환_5xx_는_AUTH_008() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withServerError()); // provider 5xx → 통신 오류

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("code-1", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
    }

    @Test
    void userinfo_단계_실패는_AUTH_008() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"at\"}", MediaType.APPLICATION_JSON));
        server[0].expect(requestTo(USERINFO_URI)).andExpect(method(HttpMethod.GET))
            .andRespond(withServerError()); // 토큰 확보 후 userinfo 실패 → 통신 오류

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("code-1", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
    }

    @Test
    void 토큰교환_timeout_은_AUTH_008() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(request -> {
                throw new ResourceAccessException("provider timeout", new SocketTimeoutException());
            });

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("sensitive-code", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .hasMessageNotContaining("sensitive-code")
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
    }

    @Test
    void 토큰응답에_access_token_이_없으면_AUTH_007() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

        KakaoOAuthStrategy strategy = new KakaoOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("sensitive-code", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .hasMessageNotContaining("sensitive-code")
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_EXCHANGE_FAILED);
    }

    @Test
    void 네이버_userinfo_필수_ID_누락은_AUTH_008() {
        assertMissingProviderIdMapsToProviderError(true);
    }

    @Test
    void 카카오_userinfo_필수_ID_누락은_AUTH_008() {
        assertMissingProviderIdMapsToProviderError(false);
    }

    @Test
    void redirectUri_화이트리스트_위반은_provider_호출없이_400() {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        // 기대 설정 없음 — HTTP 호출 전에 차단돼야 한다.

        NaverOAuthStrategy strategy = new NaverOAuthStrategy(
            restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("code-1", "https://evil.example/callback"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);
        server[0].verify(); // 어떤 요청도 나가지 않았음을 확인
    }

    private void assertMissingProviderIdMapsToProviderError(boolean naver) {
        MockRestServiceServer[] server = new MockRestServiceServer[1];
        RestClient restClient = bindMockServer(RestClient.builder(), server);
        server[0].expect(requestTo(TOKEN_URI)).andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"provider-token\"}", MediaType.APPLICATION_JSON));
        server[0].expect(requestTo(USERINFO_URI)).andExpect(method(HttpMethod.GET))
            .andRespond(withSuccess(naver ? "{\"response\":{}}" : "{}", MediaType.APPLICATION_JSON));
        AbstractOAuthProviderStrategy strategy = naver
            ? new NaverOAuthStrategy(restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics)
            : new KakaoOAuthStrategy(restClient, propertiesWith(TOKEN_URI, USERINFO_URI), oauthMetrics);

        assertThatThrownBy(() -> strategy.exchange("sensitive-code", REDIRECT_URI))
            .isInstanceOf(BusinessException.class)
            .hasMessageNotContaining("sensitive-code")
            .hasMessageNotContaining("provider-token")
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
    }
}
