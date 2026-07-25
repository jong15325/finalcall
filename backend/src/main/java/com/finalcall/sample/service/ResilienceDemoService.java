package com.finalcall.sample.service;

import org.springframework.stereotype.Service;

import com.finalcall.sample.ExternalCallException;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;

/**
 * 회복탄력성 규약 데모(Stage E2). "가짜 외부 호출"을 Retry + CircuitBreaker + fallback 으로 감싼다.
 *
 * <p>조합 순서(기본): Retry 가 바깥, CircuitBreaker 가 안. 재시도가 매번 CB 를 거치고 최종 실패가 CB 통계에 반영된다.
 * fallback 은 최외곽(Retry)에 두어 재시도가 모두 소진된 뒤(또는 회로 OPEN 즉시 실패 시) 동작한다.
 *
 * <p>★ self-invocation 금지: AOP 프록시 기반이라 외부 빈(컨트롤러)에서 호출해야 적용된다.
 * <p>★ 규약 예시일 뿐이다. 실제 외부 시스템 연동은 아니다(가짜 호출).
 */
@Slf4j
@Service
public class ResilienceDemoService {

    private static final String INSTANCE = "externalApi";

    /**
     * fail=true 면 외부 장애를 시뮬레이션한다. 멱등 조회로 가정하므로 Retry 대상이 된다
     * (부수효과 있는 호출은 무작정 재시도 금지 — 멱등성 경고 참조).
     */
    @Retry(name = INSTANCE, fallbackMethod = "callFallback")
    @CircuitBreaker(name = INSTANCE)
    public String callExternal(boolean fail) {
        log.debug("[Resilience] 외부 호출 시도 fail={}", fail);
        if (fail) {
            throw new ExternalCallException("외부 시스템 호출 실패(가짜)");
        }
        return "external-ok";
    }

    /**
     * fallback 시그니처: 원본 파라미터 목록 + 마지막에 Throwable 1개, 반환 타입 동일(어기면 fallback 을 못 찾는다).
     * 여기서는 기본값(graceful degradation)을 반환한다. 명확한 실패 응답(3단계 표준 에러)로 바꿔도 된다.
     */
    public String callFallback(boolean fail, Throwable throwable) {
        log.warn("[Resilience] fallback 동작: {}", throwable.toString());
        return "fallback: 외부 시스템 지연/실패 — 기본값 반환";
    }
}
