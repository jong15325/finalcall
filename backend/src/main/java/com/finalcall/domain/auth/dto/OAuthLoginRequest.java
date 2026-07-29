package com.finalcall.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 소셜 로그인·가입 요청(auth, 계약 §2 소셜 로그인). {@code POST /api/v1/auth/oauth/{provider}} 바디.
 *
 * <p>{@code state}(CSRF)는 프론트 소유라 바디에 두지 않는다(스테이틀리스 백엔드는 자신이 만들지 않은 state 를 검증할
 * 수 없음, 계약 §2 확정). {@code redirectUri} 는 provider 토큰 교환의 redirect_uri 일치 요건 충족용이며, 백엔드는
 * 서버 설정 화이트리스트(provider별 env)와 대조한다(open redirect·토큰 탈취 방어).
 *
 * @param code        provider 가 프론트 {@code /oauth/callback} 으로 넘긴 1회용 인가 코드
 * @param redirectUri 프론트가 인가 요청에 사용한 redirect_uri(화이트리스트 대조 대상)
 */
public record OAuthLoginRequest(
    @NotBlank(message = "인가 코드는 필수입니다.") String code,

    @NotBlank(message = "redirectUri 는 필수입니다.") String redirectUri) {
}
