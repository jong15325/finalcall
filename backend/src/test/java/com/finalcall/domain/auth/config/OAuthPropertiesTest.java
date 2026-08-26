package com.finalcall.domain.auth.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OAuth 환경변수 바인딩과 callback fail-fast 규칙을 검증한다. */
class OAuthPropertiesTest {

    private static final String[] COMPLETE_PROPERTIES = {
        "oauth.naver.client-id=naver-id",
        "oauth.naver.client-secret=naver-secret",
        "oauth.naver.redirect-uri=https://service.example/oauth/callback",
        "oauth.naver.token-uri=https://naver.example/token",
        "oauth.naver.userinfo-uri=https://naver.example/me",
        "oauth.kakao.client-id=kakao-id",
        "oauth.kakao.client-secret=kakao-secret",
        "oauth.kakao.redirect-uri=https://service.example/oauth/callback",
        "oauth.kakao.token-uri=https://kakao.example/token",
        "oauth.kakao.userinfo-uri=https://kakao.example/me"
    };

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(TestConfiguration.class)
        .withPropertyValues(COMPLETE_PROPERTIES);

    @Test
    void 모든_설정과_동일_callback이면_부팅한다() {
        runner.run(context -> assertThat(context).hasNotFailed());
    }

    @Test
    void clientSecret_누락은_부팅에_실패한다() {
        new ApplicationContextRunner()
            .withUserConfiguration(TestConfiguration.class)
            .withPropertyValues(
                "oauth.naver.client-id=naver-id",
                "oauth.naver.redirect-uri=https://service.example/oauth/callback",
                "oauth.naver.token-uri=https://naver.example/token",
                "oauth.naver.userinfo-uri=https://naver.example/me",
                "oauth.kakao.client-id=kakao-id",
                "oauth.kakao.client-secret=kakao-secret",
                "oauth.kakao.redirect-uri=https://service.example/oauth/callback",
                "oauth.kakao.token-uri=https://kakao.example/token",
                "oauth.kakao.userinfo-uri=https://kakao.example/me")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void provider_callback이_다르면_부팅에_실패한다() {
        runner.withPropertyValues("oauth.kakao.redirect-uri=https://other.example/oauth/callback")
            .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void prod에서_HTTP_callback이면_부팅에_실패한다() {
        runner.withInitializer(context -> context.getEnvironment().setActiveProfiles("prod"))
            .withPropertyValues(
                "oauth.naver.redirect-uri=http://service.example/oauth/callback",
                "oauth.kakao.redirect-uri=http://service.example/oauth/callback")
            .run(context -> assertThat(context).hasFailed());
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(OAuthProperties.class)
    static class TestConfiguration {

        @Bean
        OAuthRedirectValidator oauthRedirectValidator(OAuthProperties properties,
            org.springframework.core.env.Environment environment) {
            return new OAuthRedirectValidator(properties, environment);
        }
    }
}
