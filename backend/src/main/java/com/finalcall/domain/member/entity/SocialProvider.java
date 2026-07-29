package com.finalcall.domain.member.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 소셜 로그인 provider(member, erd §4.1 · api-contract §2 소셜 로그인). DB 는 {@code user_social_account.provider}
 * 에 {@code @Enumerated(EnumType.STRING)}으로 대문자 이름을 저장한다(VARCHAR(20)).
 *
 * <p>{@link SocialAccount} 의 신원 키(provider, provider_user_id) 한 축이다. 인가코드 교환·userinfo 조회 등
 * provider HTTP 연동은 FC-154(OAuthService) 소유이며, 본 enum 은 그 결과를 담는 모델 축만 정의한다.
 */
@Getter
@RequiredArgsConstructor
public enum SocialProvider {

    NAVER("네이버"),
    KAKAO("카카오");

    private final String description;
}
