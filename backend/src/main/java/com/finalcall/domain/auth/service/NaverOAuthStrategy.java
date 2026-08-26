package com.finalcall.domain.auth.service;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auth.config.OAuthProperties;
import com.finalcall.domain.member.entity.SocialProvider;

/**
 * 네이버 소셜 로그인 전략(auth, EPIC-OAUTH FC-154). userinfo 응답은 {@code { response: { id, nickname, name } }}
 * 형태라 신원·표시명을 {@code response} 하위에서 추출한다(네이버 표준, {@code openapi.naver.com/v1/nid/me}).
 */
@Component
public class NaverOAuthStrategy extends AbstractOAuthProviderStrategy {

    private final OAuthProperties oauthProperties;

    public NaverOAuthStrategy(RestClient oauthRestClient, OAuthProperties oauthProperties, OAuthMetrics oauthMetrics) {
        super(oauthRestClient, oauthMetrics);
        this.oauthProperties = oauthProperties;
    }

    @Override
    public SocialProvider provider() {
        return SocialProvider.NAVER;
    }

    @Override
    protected OAuthProperties.Provider providerConfig() {
        return oauthProperties.naver();
    }

    @Override
    protected OAuthUserProfile parseUserInfo(JsonNode userInfo) {
        JsonNode response = userInfo == null ? null : userInfo.get("response");
        String providerUserId = text(response, "id");
        if (providerUserId == null || providerUserId.isBlank()) {
            // 신원 키가 없으면 provider 응답 이상 → 통신 오류(502)로 매핑.
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        }
        String nickname = text(response, "nickname");
        if (nickname == null || nickname.isBlank()) {
            nickname = text(response, "name"); // nickname 미동의 시 name 대체(닉네임 확정은 SocialAccountService)
        }
        return new OAuthUserProfile(providerUserId, nickname);
    }
}
