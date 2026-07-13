package com.finalcall.common.security;

/**
 * 액세스 토큰이 싣는 인증 클레임(auth) — 프레임워크 무의존 순수 계약.
 *
 * <p>{@code userId} 는 내부 PK(SecurityContext 주체, B-009). {@code publicId} 는 외부 노출 식별자(ULID),
 * {@code admin} 은 관리자 권한 플래그. 서명/파싱 방식은 {@link TokenProvider} 구현(infra)이 담당한다.
 */
public record TokenClaims(String userId, String publicId, boolean admin) {
}
