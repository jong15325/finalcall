package com.finalcall.common.logging;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 서비스 계층 메서드 로깅 어노테이션(Stage 4, INCLUDE_SERVICE_LOG).
 *
 * <p>AccessLogFilter(HTTP 요청 단위)로는 못 잡는 서비스 메서드 단위 소요시간을 로깅한다.
 * traceId 는 이미 MDC 에 있어 로그에 자동 포함된다.
 *
 * <p>★ AOP 프록시 기반이라 self-invocation(같은 클래스 내부 호출)엔 적용되지 않는다. 외부 빈을 통해 호출한다.
 * <p>실제 부착 대상(도메인 서비스)은 Stage D 게시판 예시에서 시연한다. 이 단계는 어노테이션+Aspect 만 제공.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ServiceLog {

    /** 이 시간(ms)을 초과하면 WARN 으로 느린 메서드를 경고한다. */
    long slowMs() default 1000L;
}
