package com.finalcall.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import com.finalcall.domain.chat.listener.ChatEventPipelineMetrics;
import com.finalcall.domain.chat.listener.ChatKafkaLagReader;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatOutboxBacklogMonitorTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withBean(ChatEventOutboxRepository.class, () -> mock(ChatEventOutboxRepository.class))
        .withBean(ChatKafkaLagReader.class, () -> mock(ChatKafkaLagReader.class))
        .withBean(MeterRegistry.class, SimpleMeterRegistry::new)
        .withUserConfiguration(ChatEventPipelineMetrics.class, ChatOutboxBacklogMonitor.class);

    @Test
    void 실제_metrics_bean이_Spring_context에서_생성된다() {
        runner.run(context -> assertThat(context).hasSingleBean(ChatEventPipelineMetrics.class));
    }

    @Test
    void consumer만_활성화하면_monitor_bean을_생성하지_않는다() {
        runner.withPropertyValues(
            "chat.kafka.consumer.enabled=true",
            "chat.kafka.consumer.monitor-enabled=false")
            .run(context -> {
                assertThat(context).doesNotHaveBean(ChatOutboxBacklogMonitor.class);
                MeterRegistry registry = context.getBean(MeterRegistry.class);
                assertThat(registry.find("chat.kafka.consumer.lag.collection.age").gauge()).isNull();
            });
    }

    @Test
    void monitor설정이_없으면_monitor_bean을_생성하지_않는다() {
        runner.withPropertyValues("chat.kafka.consumer.enabled=true")
            .run(context -> assertThat(context).doesNotHaveBean(ChatOutboxBacklogMonitor.class));
    }

    @Test
    void monitor는_consumer_활성화와_독립적으로_bean을_생성한다() {
        runner.withPropertyValues(
            "chat.kafka.consumer.enabled=false",
            "chat.kafka.consumer.monitor-enabled=true")
            .run(context -> {
                assertThat(context).hasSingleBean(ChatOutboxBacklogMonitor.class);
                MeterRegistry registry = context.getBean(MeterRegistry.class);
                assertThat(registry.find("chat.kafka.consumer.lag.collection.age").gauge()).isNotNull();
            });
    }
}
