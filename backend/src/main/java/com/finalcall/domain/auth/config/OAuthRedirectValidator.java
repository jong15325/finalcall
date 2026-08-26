package com.finalcall.domain.auth.config;

import java.net.URI;
import java.util.Arrays;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** OAuth callback 설정의 provider 간 일치와 운영 HTTPS 사용을 부팅 시 검증한다. */
@Component
public class OAuthRedirectValidator implements InitializingBean {

    private static final String PROD_PROFILE = "prod";
    private static final String HTTPS_SCHEME = "https";

    private final OAuthProperties properties;
    private final Environment environment;

    public OAuthRedirectValidator(OAuthProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @Override
    public void afterPropertiesSet() {
        String naverRedirectUri = properties.naver().redirectUri();
        String kakaoRedirectUri = properties.kakao().redirectUri();
        if (!naverRedirectUri.equals(kakaoRedirectUri)) {
            throw new IllegalStateException("OAuth provider callback 설정은 동일해야 합니다.");
        }
        if (isProdProfile() && !HTTPS_SCHEME.equalsIgnoreCase(URI.create(naverRedirectUri).getScheme())) {
            throw new IllegalStateException("운영 OAuth callback은 HTTPS여야 합니다.");
        }
    }

    private boolean isProdProfile() {
        return Arrays.asList(environment.getActiveProfiles()).contains(PROD_PROFILE);
    }
}
