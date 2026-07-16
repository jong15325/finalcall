package com.finalcall.common.lock;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

/**
 * Redisson 분산락 어노테이션(Stage E1).
 *
 * <p>메서드 실행을 분산락으로 상호배제한다. 락 키는 SpEL 로 파라미터 기반 동적 생성(예: {@code "'order:' + #orderId"}).
 *
 * <p>★ AOP 프록시 기반이라 self-invocation(같은 클래스 내부 호출)엔 적용되지 않는다. 외부 빈을 통해 호출한다.
 * <p>★ 락은 트랜잭션보다 바깥에서 감싼다(락 획득 → 트랜잭션 → 커밋 → 락 해제). Aspect 우선순위로 보장한다.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {

    /** 락 키(SpEL). 예: {@code "'notice:' + #id"} */
    String key();

    /** 락 획득 대기 시간(기본 3000ms). 이 시간 안에 못 얻으면 실패. */
    long waitMs() default 3000L;

    /** 락 임대 시간(기본 10000ms). 이 시간이 지나면 자동 해제(데드락 방지). */
    long leaseMs() default 10000L;

    /** waitMs/leaseMs 의 시간 단위(기본 밀리초). */
    TimeUnit timeUnit() default TimeUnit.MILLISECONDS;
}
