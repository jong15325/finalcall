package com.finalcall.domain.sample;

import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.lock.DistributedLock;
import com.finalcall.common.util.Preconditions;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * 샘플 도메인 서비스 — Stage 1 수직 슬라이스 + Stage 3 예외/검증 + Stage 5 커스텀 메트릭 데모용.
 *
 * <p>controller → service 흐름만 성립하면 된다(DB/Redis 없음).
 * 실제 도메인 서비스 컨벤션(@Transactional, @ServiceLog 등)은 Stage D 이후 적용한다.
 */
@Service
public class SampleService {

    private final MeterRegistry meterRegistry;

    public SampleService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public String getMessage() {
        return "Hello, FinalCall!";
    }

    /**
     * Preconditions 사용 예시(Stage 3): 조건이 거짓이면 BusinessException(NOT_FOUND).
     * 도메인별 ErrorCode 는 아직 없으므로 공통 코드로 시연한다.
     */
    public void ensureExists(boolean exists) {
        Preconditions.validate(exists, CommonErrorCode.NOT_FOUND);
    }

    /**
     * 커스텀 메트릭 규약 데모(Stage 5): {@code @Timed}(AOP 프록시라 self-invocation 함정) 대신
     * MeterRegistry 를 직접 주입해 Counter(호출 수) + Timer(처리 소요시간)를 기록한다.
     *
     * <p>★ 태그는 저카디널리티만 사용한다(result=success|fail). userId/path variable/UUID 등 고유값 금지.
     */
    public String processWithMetrics() {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = "success";
        try {
            return getMessage();
        } catch (RuntimeException e) {
            outcome = "fail";
            throw e;
        } finally {
            sample.stop(meterRegistry.timer("finalcall.sample.processing"));
            meterRegistry.counter("finalcall.sample.calls", "result", outcome).increment();
        }
    }

    /**
     * 캐시 데모(Stage E1): 첫 호출은 실제 생성, 이후 TTL 동안은 캐시에서 반환(generatedAt 이 고정됨).
     * generatedAt(Instant)로 JSON 직렬화와 캐시 히트 여부를 확인한다.
     */
    @Cacheable(cacheNames = "sample", key = "#id")
    public SampleCacheValue getCached(Long id) {
        return new SampleCacheValue("cached-value-" + id, Instant.now());
    }

    /** 캐시 무효화 데모(Stage E1). */
    @CacheEvict(cacheNames = "sample", key = "#id")
    public void evictCached(Long id) {
        // 캐시 항목 제거(반환 없음). 다음 getCached 호출은 다시 생성한다.
    }

    /**
     * 분산락 데모(Stage E1): 락이 트랜잭션을 감싸는 구조. 동시 호출 시 상호배제된다.
     * self-invocation 회피를 위해 외부 빈(컨트롤러)에서 호출해야 프록시가 적용된다.
     */
    @DistributedLock(key = "'sample:lock:' + #id")
    @Transactional
    public long lockedProcess(Long id) {
        long start = System.currentTimeMillis();
        try {
            Thread.sleep(300L); // 임계 구역 시뮬레이션(동시성 관찰용)
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return System.currentTimeMillis() - start;
    }
}
