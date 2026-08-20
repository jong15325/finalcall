package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatRedisPipelineMetricsAspectTest {

    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final ChatRedisPipelineMetricsAspect aspect = new ChatRedisPipelineMetricsAspect(meterRegistry);
    private final ProceedingJoinPoint joinPoint = mock(ProceedingJoinPoint.class);

    @Test
    void publish_결과와_실패를_구분해_기록한다() throws Throwable {
        when(joinPoint.proceed()).thenReturn(true, false);

        aspect.observePublish(joinPoint);
        aspect.observePublish(joinPoint);

        assertThat(meterRegistry.get("chat.redis.publish.total").tag("result", "succeeded")
            .counter().count()).isEqualTo(1.0);
        assertThat(meterRegistry.get("chat.redis.publish.total").tag("result", "failed")
            .counter().count()).isEqualTo(1.0);
        assertThat(meterRegistry.get("chat.redis.publish.failures").counter().count()).isEqualTo(1.0);
    }

    @Test
    void 예상하지_못한_publish_예외도_실패로_기록하고_전파한다() throws Throwable {
        when(joinPoint.proceed()).thenThrow(new IllegalStateException("redis"));

        assertThatThrownBy(() -> aspect.observePublish(joinPoint))
            .isInstanceOf(IllegalStateException.class);

        assertThat(meterRegistry.get("chat.redis.publish.failures").counter().count()).isEqualTo(1.0);
    }

    @Test
    void Redis_event_수신을_기록한다() {
        aspect.recordReceived();

        assertThat(meterRegistry.get("chat.redis.events.received").counter().count()).isEqualTo(1.0);
    }
}
