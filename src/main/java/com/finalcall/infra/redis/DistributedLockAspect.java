package com.finalcall.infra.redis;

import java.lang.reflect.Method;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.context.expression.MethodBasedEvaluationContext;
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Component;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.lock.DistributedLock;

import lombok.extern.slf4j.Slf4j;

/**
 * {@link DistributedLock} 처리 Aspect(Stage E1).
 *
 * <p>★★ 락-트랜잭션 순서: 락은 트랜잭션보다 <b>바깥</b>이어야 한다(락 획득 → 트랜잭션 시작 → 커밋 → 락 해제).
 * 트랜잭션 AOP(LOWEST_PRECEDENCE)보다 먼저 실행되도록 {@code @Order} 를 최상위 우선순위로 둔다.
 * 락을 트랜잭션 안에서 풀면 커밋 전에 다음 스레드가 진입해 정합성이 깨진다.
 *
 * <p>어노테이션은 인자 바인딩(@annotation(x)) 대신 리플렉션으로 조회한다. 인자 바인딩은 다른 어드바이스(@Order)와
 * 함께일 때 JoinPointMatch 바인딩이 깨질 수 있어, ProceedingJoinPoint 하나만 바인딩한다.
 */
@Slf4j
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE) // 트랜잭션보다 바깥(먼저 실행 = 락이 트랜잭션을 감쌈)
public class DistributedLockAspect {

    private final RedissonClient redissonClient;
    private final SpelExpressionParser parser = new SpelExpressionParser();
    private final DefaultParameterNameDiscoverer parameterNameDiscoverer = new DefaultParameterNameDiscoverer();

    public DistributedLockAspect(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    @Around("@annotation(com.finalcall.common.lock.DistributedLock)")
    public Object lock(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature)joinPoint.getSignature();
        Method method = signature.getMethod();
        DistributedLock distributedLock = method.getAnnotation(DistributedLock.class);

        String key = parseKey(joinPoint, method, distributedLock.key());
        RLock lock = redissonClient.getLock(key);

        boolean acquired = false;
        try {
            acquired = lock.tryLock(distributedLock.waitMs(), distributedLock.leaseMs(), distributedLock.timeUnit());
            if (!acquired) {
                log.warn("[DistributedLock] 락 획득 실패 key={}", key);
                throw new BusinessException(CommonErrorCode.LOCK_ACQUISITION_FAILED);
            }
            log.debug("[DistributedLock] 락 획득 key={}", key);
            return joinPoint.proceed(); // 트랜잭션 등 내부 AOP 는 이 안에서 실행된다(락이 바깥).
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(CommonErrorCode.LOCK_ACQUISITION_FAILED);
        } finally {
            if (acquired && lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("[DistributedLock] 락 해제 key={}", key);
            }
        }
    }

    /** SpEL 로 파라미터 기반 동적 락 키를 만든다. */
    private String parseKey(ProceedingJoinPoint joinPoint, Method method, String keyExpression) {
        MethodBasedEvaluationContext context = new MethodBasedEvaluationContext(
            null, method, joinPoint.getArgs(), parameterNameDiscoverer);
        Expression expression = parser.parseExpression(keyExpression);
        return String.valueOf(expression.getValue(context));
    }
}
