package com.finalcall.domain.auth.service;

import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.auth.config.OAuthProperties;
import com.finalcall.domain.auth.service.OAuthMetrics.Phase;
import com.finalcall.domain.auth.service.OAuthMetrics.Result;

/**
 * OAuth provider 전략 공통 골격(auth, EPIC-OAUTH FC-154) — 토큰 교환·HTTP 호출·오류 매핑을 캡슐화한다.
 *
 * <p>provider별로 다른 것은 (1) 어떤 설정을 쓰는가({@link #providerConfig()}), (2) userinfo 응답을 어떻게
 * 파싱하는가({@link #parseUserInfo(JsonNode)}) 둘뿐이라 이를 추상 메서드로 남기고 나머지는 여기서 공유한다.
 *
 * <p><b>오류 매핑(계약 §2·§5):</b> 토큰 교환의 4xx(무효·만료·재사용 코드)는 {@code AUTH_007}(401), 그 외
 * provider 오류·5xx·타임아웃·IO 는 {@code AUTH_008}(502)로 통일한다. userinfo 단계의 모든 실패는 통신 오류로
 * 보고 {@code AUTH_008}(502)로 매핑한다(토큰은 이미 확보한 뒤라 4xx 도 provider 이상으로 취급). redirectUri
 * 화이트리스트 위반은 provider 호출 이전에 400 으로 차단한다(open redirect 방어).
 */
public abstract class AbstractOAuthProviderStrategy implements OAuthProviderStrategy {

    private static final String GRANT_TYPE = "authorization_code";

    private final RestClient oauthRestClient;
    private final OAuthMetrics oauthMetrics;

    protected AbstractOAuthProviderStrategy(RestClient oauthRestClient, OAuthMetrics oauthMetrics) {
        this.oauthRestClient = oauthRestClient;
        this.oauthMetrics = oauthMetrics;
    }

    /** 이 전략이 사용할 provider 설정(client id/secret·URI). */
    protected abstract OAuthProperties.Provider providerConfig();

    /** provider userinfo 응답(JSON)에서 신원·표시명을 추출한다(provider별 스키마 상이). */
    protected abstract OAuthUserProfile parseUserInfo(JsonNode userInfo);

    @Override
    public OAuthUserProfile exchange(String code, String redirectUri) {
        OAuthProperties.Provider config = providerConfig();
        // open redirect·토큰 탈취 방어: 요청 redirectUri 를 서버 설정 화이트리스트와 대조(불일치 400).
        Preconditions.validate(config.redirectUri().equals(redirectUri), CommonErrorCode.INVALID_INPUT);

        String accessToken = requestAccessToken(config, code, redirectUri);
        long startedAt = oauthMetrics.start();
        try {
            JsonNode userInfo = requestUserInfo(config, accessToken);
            OAuthUserProfile profile = parseUserInfo(userInfo);
            oauthMetrics.recordProviderCall(provider(), Phase.USERINFO, Result.SUCCESS, startedAt);
            return profile;
        } catch (BusinessException e) {
            oauthMetrics.recordProviderCall(provider(), Phase.USERINFO, Result.PROVIDER_ERROR, startedAt);
            throw e;
        }
    }

    /**
     * 인가 코드를 access token 으로 교환한다(form POST). 4xx = 코드 무효·만료·재사용 → {@code AUTH_007},
     * 5xx·IO·타임아웃 → {@code AUTH_008}. 200 이나 access_token 이 없으면 교환 실패로 보고 {@code AUTH_007}.
     */
    private String requestAccessToken(OAuthProperties.Provider config, String code, String redirectUri) {
        long startedAt = oauthMetrics.start();
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", GRANT_TYPE);
        form.add("client_id", config.clientId());
        form.add("client_secret", config.clientSecret());
        form.add("code", code);
        form.add("redirect_uri", redirectUri);

        JsonNode body;
        try {
            body = oauthRestClient.post()
                .uri(config.tokenUri())
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
        } catch (HttpClientErrorException e) {
            oauthMetrics.recordProviderCall(provider(), Phase.TOKEN, Result.EXCHANGE_FAILED, startedAt);
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_EXCHANGE_FAILED); // 4xx = 인가코드 교환 실패
        } catch (RestClientException e) {
            oauthMetrics.recordProviderCall(provider(), Phase.TOKEN, Result.PROVIDER_ERROR, startedAt);
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR); // 5xx·타임아웃·IO
        }
        String accessToken = text(body, "access_token");
        if (accessToken == null || accessToken.isBlank()) {
            oauthMetrics.recordProviderCall(provider(), Phase.TOKEN, Result.EXCHANGE_FAILED, startedAt);
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_EXCHANGE_FAILED);
        }
        oauthMetrics.recordProviderCall(provider(), Phase.TOKEN, Result.SUCCESS, startedAt);
        return accessToken;
    }

    /**
     * access token 으로 userinfo 를 조회한다(Bearer). 토큰 확보 이후 단계라 모든 실패(4xx·5xx·IO)를 provider
     * 통신 오류로 보고 {@code AUTH_008}(502)로 매핑한다.
     */
    private JsonNode requestUserInfo(OAuthProperties.Provider config, String accessToken) {
        try {
            return oauthRestClient.get()
                .uri(config.userinfoUri())
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(JsonNode.class);
        } catch (RestClientException e) {
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        }
    }

    /** JSON 노드에서 텍스트 필드를 안전하게 읽는다(부재·null 이면 null). */
    protected static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}
