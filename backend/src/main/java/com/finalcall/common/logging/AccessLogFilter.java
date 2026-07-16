package com.finalcall.common.logging;

import java.io.IOException;

import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * 접근 로그 필터(Stage 4, ACCESS_LOG_ENABLED).
 *
 * <p>{@link MdcContextFilter} 와 관심사를 분리한 독립 필터. 요청 완료 시 method/path/status/elapsedMs 를 INFO 한 줄로 남긴다.
 * MdcContextFilter 보다 안쪽(inner)에서 동작하므로 traceId/컨텍스트가 로그에 함께 담긴다.
 *
 * <p>★ 요청/응답 바디, 헤더 전체 덤프는 하지 않는다(민감정보 유출 방지).
 */
@Slf4j
public class AccessLogFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        long startMs = System.currentTimeMillis();
        try {
            chain.doFilter(request, response);
        } finally {
            long elapsedMs = System.currentTimeMillis() - startMs;
            log.info("{} {} {} {}ms", request.getMethod(), request.getRequestURI(), response.getStatus(), elapsedMs);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // actuator/health 등 헬스체크성 경로는 접근 로그에서 제외(노이즈 억제).
        return request.getRequestURI().startsWith("/actuator");
    }
}
