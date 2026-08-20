package com.finalcall.common.security;

import java.time.Instant;

/**
 * 액세스 토큰이 싣는 인증 클레임(auth) — 프레임워크 무의존 순수 계약.
 *
 * <p>{@code userId} 는 내부 PK(SecurityContext 주체, B-009). {@code publicId} 는 외부 노출 식별자(ULID),
 * {@code admin} 은 관리자 권한 플래그. {@code expiresAt} 은 검증된 access JWT 만료 시각이며, 발급 입력에서는
 * {@code null} 이어도 된다. 서명/파싱 방식은 {@link TokenProvider} 구현(infra)이 담당한다.
 */
public record TokenClaims(String userId, String publicId, boolean admin, Instant expiresAt) {

    /** access token 발급 입력용 하위 호환 생성자. 만료 시각은 provider 정책으로 결정한다. */
    public TokenClaims(String userId, String publicId, boolean admin) {
        this(userId, publicId, admin, null);
    }
}
