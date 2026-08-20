package com.finalcall.infra.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.response.ErrorResponse;
import com.finalcall.infra.config.GatewayInternalProperties;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * 직접접근 차단 필터(D-068).
 *
 * <p>엣지 게이트웨이(SCG)가 부착한 공유비밀({@code X-Gateway-Token})을 검증해, 게이트웨이를 거치지 않은
 * 직접 접근(헤더 부재·불일치)을 403 으로 차단한다. 인증(JWT) 이전 관문이므로 JWT 필터보다 앞에 둔다.
 *
 * <p>제외 경로: actuator(헬스 포함)·error 는 게이트웨이 밖(로컬 헬스체크·컨테이너 프로브 등)에서 직접
 * 접근할 수 있어야 하므로 검사에서 제외한다. 응답은 3단계 {@link ErrorResponse} 포맷으로 통일하며,
 * 코드는 계약 [1.6]에 맞춰 {@link GatewayErrorCode#DIRECT_ACCESS_BLOCKED}(GATEWAY_403)를 반환한다.
 *
 * <p>{@code enforced=false}(통합테스트 등 게이트웨이 미경유 환경)면 검사를 건너뛴다.
 */
@Slf4j
public class GatewayAccessFilter extends OncePerRequestFilter {

    private static final String ACTUATOR_PREFIX = "/actuator";
    private static final String ERROR_PATH = "/error";

    private final GatewayInternalProperties properties;
    private final ObjectMapper objectMapper;
    private final byte[] expectedSecret;

    public GatewayAccessFilter(GatewayInternalProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.expectedSecret = properties.secret().getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!properties.enforced()) {
            return true;
        }
        String uri = request.getRequestURI();
        return uri.startsWith(ACTUATOR_PREFIX) || uri.equals(ERROR_PATH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String token = request.getHeader(properties.header());
        if (!matchesSecret(token)) {
            log.warn("[GatewayAccess] 직접접근 차단 — 공유비밀 불일치/부재. uri={}", request.getRequestURI());
            writeForbidden(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean matchesSecret(String actualSecret) {
        byte[] actual = actualSecret == null
            ? new byte[0]
            : actualSecret.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedSecret, actual);
    }

    private void writeForbidden(HttpServletResponse response) throws IOException {
        response.setStatus(GatewayErrorCode.DIRECT_ACCESS_BLOCKED.getStatus().value());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(GatewayErrorCode.DIRECT_ACCESS_BLOCKED));
    }
}
