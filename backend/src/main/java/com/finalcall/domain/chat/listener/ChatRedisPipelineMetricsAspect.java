package com.finalcall.domain.chat.listener;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

/** fast-path와 Kafka replay가 공유하는 Redis publish/receive 경계의 저카디널리티 metric. */
@Aspect
@Component
public class ChatRedisPipelineMetricsAspect {

    private final Counter publishSucceeded;
    private final Counter publishFailed;
    private final Counter publishFailures;
    private final Counter eventsReceived;

    public ChatRedisPipelineMetricsAspect(MeterRegistry meterRegistry) {
        this.publishSucceeded = Counter.builder("chat.redis.publish.total")
            .tag("result", "succeeded")
            .description("채팅 Redis fan-out publish 시도 횟수")
            .register(meterRegistry);
        this.publishFailed = Counter.builder("chat.redis.publish.total")
            .tag("result", "failed")
            .description("채팅 Redis fan-out publish 시도 횟수")
            .register(meterRegistry);
        this.publishFailures = Counter.builder("chat.redis.publish.failures")
            .description("채팅 Redis fan-out publish 실패 횟수")
            .register(meterRegistry);
        this.eventsReceived = Counter.builder("chat.redis.events.received")
            .description("app node가 Redis에서 수신한 채팅 fan-out event 수")
            .register(meterRegistry);
    }

    @Around("execution(boolean com.finalcall.domain.chat.realtime.ChatRedisFanoutPublisher.publish(String))")
    public Object observePublish(ProceedingJoinPoint joinPoint) throws Throwable {
        try {
            Object result = joinPoint.proceed();
            recordPublish(Boolean.TRUE.equals(result));
            return result;
        } catch (Throwable throwable) {
            recordPublish(false);
            throw throwable;
        }
    }

    @Before("execution(void com.finalcall.domain.chat.listener.ChatRedisFanoutListener.onMessage(..))")
    public void recordReceived() {
        eventsReceived.increment();
    }

    private void recordPublish(boolean succeeded) {
        if (succeeded) {
            publishSucceeded.increment();
            return;
        }
        publishFailed.increment();
        publishFailures.increment();
    }
}
