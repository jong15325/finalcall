package com.finalcall.infra.security;

import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

/**
 * JWT 인증 필터(Stage F1).
 *
 * <p>Authorization: Bearer 토큰을 추출·검증해 유효하면 {@link org.springframework.security.core.Authentication}
 * 을 SecurityContext 에 적재한다. 무효/부재 시 컨텍스트를 비우고 체인을 계속한다(막는 것은 EntryPoint).
 *
 * <p>★ 인증 성공 시 사용자 식별자를 MDC("userId")에 적재하고(4단계 자리 연결) 요청 종료 시 정리한다.
 */
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String AUTH_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String MDC_USER_ID = "userId";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final TokenProvider tokenProvider;

    public JwtAuthenticationFilter(TokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean userIdSet = false;
        try {
            String token = resolveToken(request);
            if (token != null) {
                try {
                    // 주체(principal)는 userId(내부 PK). 헤더(X-User-Id) 신뢰 없이 토큰 검증분만 사용(B-009).
                    TokenClaims claims = tokenProvider.parseAccessToken(token);
                    List<GrantedAuthority> authorities = claims.admin()
                            ? List.of(new SimpleGrantedAuthority(ROLE_ADMIN))
                            : Collections.emptyList();
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(claims.userId(), null, authorities);
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    MDC.put(MDC_USER_ID, claims.userId());
                    userIdSet = true;
                } catch (Exception e) {
                    // 무효/만료 토큰 → 컨텍스트 비움(막는 것은 EntryPoint 의 401).
                    SecurityContextHolder.clearContext();
                    log.debug("[JwtAuth] 토큰 검증 실패: {}", e.getMessage());
                }
            }
            chain.doFilter(request, response);
        } finally {
            if (userIdSet) {
                MDC.remove(MDC_USER_ID); // MdcContextFilter 정리 정책과 일관(우리가 넣은 키만 제거).
            }
        }
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(AUTH_HEADER);
        if (StringUtils.hasText(header) && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
