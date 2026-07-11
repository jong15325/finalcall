/**
 * 보안 인프라(Stage F1).
 *
 * <p>{@link com.finalcall.infra.security.HmacTokenProvider}(HS256 서명/검증),
 * {@link com.finalcall.infra.security.JwtAuthenticationFilter}(Bearer 검증→SecurityContext, userId MDC),
 * {@link com.finalcall.infra.security.JwtAuthenticationEntryPoint}(401)·
 * {@link com.finalcall.infra.security.JwtAccessDeniedHandler}(403)는 ErrorResponse 로 통일,
 * {@link com.finalcall.infra.security.SecurityAuditorAware}(작성자 auditing, 비인증 시 null).
 * SecurityFilterChain 은 {@code infra.config.SecurityConfig}.
 */
package com.finalcall.infra.security;
