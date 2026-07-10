package com.finalcall.common.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 요청 단위 MDC 컨텍스트 필터(Stage 4).
 *
 * <p>역할(traceId 생성이 아님):
 * <ol>
 *   <li>라이브러리(Micrometer)가 MDC 에 넣어둔 traceId 를 <b>읽어서</b> 응답 헤더 {@value #REQUEST_ID_HEADER} 로 전달.</li>
 *   <li>요청 단위 비즈니스 컨텍스트(httpMethod, requestUri)를 MDC 에 추가. (userId 는 인증 도입 F1 후)</li>
 * </ol>
 *
 * <p>★ traceId/spanId 를 직접 MDC.put/UUID 로 생성하지 않는다(Micrometer 값과 충돌). 정리 시에도
 * 이 필터가 추가한 키만 제거하고 라이브러리 소유 키(traceId/spanId)는 건드리지 않는다.
 */
public class MdcContextFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final String MDC_TRACE_ID = "traceId";
    private static final String MDC_HTTP_METHOD = "httpMethod";
    private static final String MDC_REQUEST_URI = "requestUri";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String traceId = MDC.get(MDC_TRACE_ID);
            if (traceId != null) {
                response.setHeader(REQUEST_ID_HEADER, traceId);
            }
            MDC.put(MDC_HTTP_METHOD, request.getMethod());
            MDC.put(MDC_REQUEST_URI, request.getRequestURI());
            chain.doFilter(request, response);
        } finally {
            // 우리가 추가한 키만 제거(스레드풀 재사용 시 다음 요청으로 값이 새지 않도록).
            MDC.remove(MDC_HTTP_METHOD);
            MDC.remove(MDC_REQUEST_URI);
        }
    }
}
