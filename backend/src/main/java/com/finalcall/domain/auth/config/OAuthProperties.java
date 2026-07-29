package com.finalcall.domain.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 소셜 로그인(OAuth) provider 설정 바인딩(auth, EPIC-OAUTH FC-154, 계약 §2 소셜 로그인).
 *
 * <p>provider별(naver·kakao) client-id/secret·redirect-uri·token-uri·userinfo-uri 를 담는다. secret 은
 * fail-fast 로 주입한다: local 은 {@code ${ENV:빈값}} 기본, dev/prod 는 환경변수(예 {@code OAUTH_NAVER_CLIENT_SECRET})
 * relaxed binding(기본값 없음 → 누락 시 {@code @NotBlank} 로 부팅 실패). <b>시크릿·키 값은 커밋하지 않는다</b>
 * (application.yml 은 {@code ${ENV}} 참조만, 실값은 {@code .env}).
 *
 * <p>token-uri·userinfo-uri 는 provider 표준 상수를 application.yml 기본값으로 두되 오버라이드 여지를 남긴다.
 * {@code redirect-uri} 는 프론트 {@code /oauth/callback} 값과 동일해야 하며(provider 토큰 교환의 redirect_uri
 * 일치 요건) 백엔드는 이 서버 설정값을 화이트리스트로 삼아 요청 {@code redirectUri} 를 대조한다(open redirect 방어).
 */
@Validated
@ConfigurationProperties(prefix = "oauth")
public record OAuthProperties(
    @Valid @NotNull(message = "네이버 OAuth 설정이 필요합니다.") Provider naver,
    @Valid @NotNull(message = "카카오 OAuth 설정이 필요합니다.") Provider kakao) {

    /**
     * 단일 provider 설정. 모든 필드가 {@code @NotBlank} 라 값이 비면 부팅이 실패한다(조용한 기본값 대체 금지).
     *
     * @param clientId     provider 발급 client id
     * @param clientSecret provider 발급 client secret(★ 시크릿 — env 주입, 커밋 금지)
     * @param redirectUri  프론트 인가 요청 redirect_uri(화이트리스트 대조 기준·토큰 교환 일치 요건)
     * @param tokenUri     provider 토큰 교환 엔드포인트
     * @param userinfoUri  provider userinfo 엔드포인트
     */
    public record Provider(
        @NotBlank String clientId,
        @NotBlank String clientSecret,
        @NotBlank String redirectUri,
        @NotBlank String tokenUri,
        @NotBlank String userinfoUri) {
    }
}
