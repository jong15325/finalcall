package com.finalcall.domain.auth.service;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.auth.config.OAuthProperties;
import com.finalcall.domain.member.entity.SocialProvider;

/**
 * 카카오 소셜 로그인 전략(auth, EPIC-OAUTH FC-154). userinfo 응답은 {@code { id, kakao_account: { profile:
 * { nickname } } }} 형태라 최상위 {@code id} 를 신원으로, {@code kakao_account.profile.nickname} 을 표시명으로
 * 추출한다(카카오 표준, {@code kapi.kakao.com/v2/user/me}).
 */
@Component
public class KakaoOAuthStrategy extends AbstractOAuthProviderStrategy {

    private final OAuthProperties oauthProperties;

    public KakaoOAuthStrategy(RestClient oauthRestClient, OAuthProperties oauthProperties, OAuthMetrics oauthMetrics) {
        super(oauthRestClient, oauthMetrics);
        this.oauthProperties = oauthProperties;
    }

    @Override
    public SocialProvider provider() {
        return SocialProvider.KAKAO;
    }

    @Override
    protected OAuthProperties.Provider providerConfig() {
        return oauthProperties.kakao();
    }

    @Override
    protected OAuthUserProfile parseUserInfo(JsonNode userInfo) {
        String providerUserId = text(userInfo, "id"); // 카카오 회원번호(숫자 → 문자열)
        if (providerUserId == null || providerUserId.isBlank()) {
            // 신원 키가 없으면 provider 응답 이상 → 통신 오류(502)로 매핑.
            throw new BusinessException(AuthErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        }
        JsonNode account = userInfo.get("kakao_account");
        JsonNode profile = account == null ? null : account.get("profile");
        String nickname = text(profile, "nickname");
        return new OAuthUserProfile(providerUserId, nickname);
    }
}
