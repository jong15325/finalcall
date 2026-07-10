package com.finalcall.infra.config;

import com.finalcall.common.logging.AccessLogFilter;
import com.finalcall.common.logging.MdcContextFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

/**
 * 로깅 필터 등록(Stage 4).
 *
 * <p>필터 순서(중요):
 * <ul>
 *   <li>MdcContextFilter 가 AccessLogFilter 보다 바깥(먼저) → 접근 로그에도 traceId/컨텍스트가 담긴다.</li>
 *   <li>단, 둘 다 Micrometer 추적 필터보다는 안쪽이어야 한다(traceId 를 라이브러리가 먼저 MDC 에 넣어야 읽을 수 있음).
 *       → HIGHEST_PRECEDENCE 로 잡지 않고, 그보다 약간 낮은 우선순위에서 Mdc &lt; Access 순으로 부여.</li>
 * </ul>
 */
@Configuration
public class LoggingConfig {

    // HIGHEST_PRECEDENCE 보다 약간 낮게(값이 클수록 후순위=안쪽). Micrometer 추적 필터보다 안쪽에 위치시킨다.
    private static final int MDC_FILTER_ORDER = Ordered.HIGHEST_PRECEDENCE + 10;
    private static final int ACCESS_LOG_FILTER_ORDER = Ordered.HIGHEST_PRECEDENCE + 20;

    @Bean
    public FilterRegistrationBean<MdcContextFilter> mdcContextFilter() {
        FilterRegistrationBean<MdcContextFilter> registration = new FilterRegistrationBean<>(new MdcContextFilter());
        registration.setOrder(MDC_FILTER_ORDER);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Bean
    public FilterRegistrationBean<AccessLogFilter> accessLogFilter() {
        FilterRegistrationBean<AccessLogFilter> registration = new FilterRegistrationBean<>(new AccessLogFilter());
        registration.setOrder(ACCESS_LOG_FILTER_ORDER);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
