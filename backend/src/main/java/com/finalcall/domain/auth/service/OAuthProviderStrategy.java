package com.finalcall.domain.auth.service;

import com.finalcall.domain.member.entity.SocialProvider;

/**
 * 소셜 로그인 provider 전략(auth, EPIC-OAUTH FC-154). provider별(naver·kakao) 인가코드 교환·userinfo 조회를
 * 캡슐화한다 — {@link OAuthService} 는 provider 로 전략을 선택해 {@link #exchange} 만 호출한다(개방-폐쇄).
 *
 * <p>공통 흐름(토큰 교환·HTTP·오류 매핑)은 {@link AbstractOAuthProviderStrategy} 가 제공하고, provider별로 다른
 * userinfo 응답 파싱만 하위 전략이 구현한다.
 */
public interface OAuthProviderStrategy {

    /** 이 전략이 담당하는 provider(전략 선택 키). */
    SocialProvider provider();

    /**
     * 인가 코드를 provider 토큰으로 교환하고 userinfo 를 조회해 소셜 프로필을 반환한다.
     *
     * @param code        provider 1회용 인가 코드
     * @param redirectUri 프론트 인가 요청 redirect_uri(서버 화이트리스트 대조 후 토큰 교환에 사용)
     * @return provider userinfo 에서 추출한 {@link OAuthUserProfile}
     */
    OAuthUserProfile exchange(String code, String redirectUri);
}
