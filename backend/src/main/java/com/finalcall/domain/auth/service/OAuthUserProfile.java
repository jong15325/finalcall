package com.finalcall.domain.auth.service;

/**
 * provider userinfo 에서 추출한 소셜 프로필(auth, EPIC-OAUTH FC-154) — 서비스 내부 계산 VO(영속·직렬화 아님).
 *
 * <p>신원 키는 {@code providerUserId}(provider 가 발급한 안정 식별자)이며, {@code nickname} 은 표시명(신규 가입 시
 * 기본 닉네임 후보, UK 충돌 시 SocialAccountService 가 접미사 회피). 이메일은 신원이 아니라 프로필 데이터라 담지
 * 않는다(결정 2, 소셜 이메일 미저장).
 *
 * @param providerUserId provider 발급 사용자 식별자(신원 키의 한 축)
 * @param nickname       provider 표시명(신규 가입 기본 닉네임 후보, 비어 있을 수 있음)
 */
public record OAuthUserProfile(String providerUserId, String nickname) {
}
