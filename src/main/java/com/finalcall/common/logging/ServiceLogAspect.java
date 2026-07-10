package com.finalcall.common.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;

/**
 * {@link ServiceLog} 처리 Aspect(Stage 4).
 *
 * <p>메서드 진입/종료 소요시간을 측정해, {@link ServiceLog#slowMs()} 초과 시 WARN, 그 외 DEBUG 로 로깅한다.
 * traceId 는 MDC 에 있으므로 로그 패턴/JSON 에 자동 포함된다.
 */
@Slf4j
@Aspect
@Component
public class ServiceLogAspect {

    @Around("@annotation(serviceLog)")
    public Object logServiceMethod(ProceedingJoinPoint joinPoint, ServiceLog serviceLog) throws Throwable {
        String target = methodName(joinPoint);
        long startMs = System.currentTimeMillis();
        try {
            return joinPoint.proceed();
        } finally {
            long elapsedMs = System.currentTimeMillis() - startMs;
            if (elapsedMs > serviceLog.slowMs()) {
                log.warn("[ServiceLog][SLOW] {} ({}ms > {}ms)", target, elapsedMs, serviceLog.slowMs());
            } else {
                log.debug("[ServiceLog] {} ({}ms)", target, elapsedMs);
            }
        }
    }

    private String methodName(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        return signature.getDeclaringType().getSimpleName() + "." + signature.getName();
    }
}
