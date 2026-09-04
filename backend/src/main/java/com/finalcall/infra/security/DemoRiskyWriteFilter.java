package com.finalcall.infra.security;

import java.io.IOException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.exception.AuthErrorCode;
import com.finalcall.common.response.ErrorResponse;
import com.finalcall.domain.member.entity.AccountType;
import com.finalcall.domain.member.repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** DB account_type을 권위로 삼아 계약에 열거된 DEMO 위험 쓰기만 차단한다. */
public class DemoRiskyWriteFilter extends OncePerRequestFilter {

    private static final AntPathMatcher PATHS = new AntPathMatcher();
    private static final String[] RISKY_PATHS = {
        "/api/v1/me", "/api/v1/me/email/**", "/api/v1/me/money/**", "/api/v1/me/inventory/**",
        "/api/v1/me/temp-storage/**", "/api/v1/me/memos/**", "/api/v1/me/chat-rooms/**",
        "/api/v1/auctions/**", "/api/v1/shops/**", "/api/v1/boards/**", "/api/v1/posts/**",
        "/api/v1/comments/**", "/api/v1/board-images/**", "/api/v1/admin/**", "/api/v1/exchanges"
    };

    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public DemoRiskyWriteFilter(UserRepository userRepository, ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && isRiskyWrite(request) && isDemo(authentication.getName())) {
            response.setStatus(AuthErrorCode.AUTH_DEMO_READ_ONLY.getStatus().value());
            response.setContentType("application/json;charset=UTF-8");
            objectMapper.writeValue(response.getWriter(), ErrorResponse.of(AuthErrorCode.AUTH_DEMO_READ_ONLY));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isRiskyWrite(HttpServletRequest request) {
        if ("GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod())
            || "OPTIONS".equals(request.getMethod())) {
            return false;
        }
        if ("PUT".equals(request.getMethod())
            && PATHS.match("/api/v1/me/chat-rooms/*/read", request.getRequestURI())) {
            return false;
        }
        return java.util.Arrays.stream(RISKY_PATHS).anyMatch(pattern -> PATHS.match(pattern, request.getRequestURI()));
    }

    private boolean isDemo(String userId) {
        if (userRepository == null) {
            return false;
        }
        try {
            return userRepository.findByIdAndIsDeletedFalse(Long.parseLong(userId))
                .map(user -> user.getAccountType() == AccountType.DEMO)
                .orElse(false);
        } catch (NumberFormatException exception) {
            return false;
        }
    }
}
