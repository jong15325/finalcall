package com.finalcall.common.security;

/**
 * 액세스 토큰 서명/검증 추상화(Stage F1, auth 클레임 정합) — 서명 방식 교체 가능 구조의 핵심.
 *
 * <p>HS256 대칭키 구현(HmacTokenProvider)으로 시작한다.
 * ★ 확장 자리: MSA 로 검증 주체가 늘면 RS256(공개키 검증) 구현(RsaTokenProvider)으로 갈아끼운다.
 *   jwt.algorithm 설정으로 Provider 를 선택하는 구조로 확장한다(현재는 HS256 단일).
 *
 * <p>토큰은 인증 클레임({@link TokenClaims}: userId·publicId·isAdmin)을 싣는다(B-009 — SecurityContext 주체 식별).
 * common 에는 프레임워크/서명 라이브러리 의존을 두지 않는다(순수 계약). 구현은 infra 에 둔다.
 */
public interface TokenProvider {

    /** 인증 클레임으로 액세스 토큰을 생성한다. */
    String generateAccessToken(TokenClaims claims);

    /** 액세스 토큰을 검증하고 클레임을 반환한다. 무효/만료 시 예외를 던진다. */
    TokenClaims parseAccessToken(String token);
}
