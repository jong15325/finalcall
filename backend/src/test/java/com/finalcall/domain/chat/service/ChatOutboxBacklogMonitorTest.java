package com.finalcall.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import com.finalcall.domain.chat.listener.ChatEventPipelineMetrics;
import com.finalcall.domain.chat.listener.ChatKafkaLagReader;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;

class ChatOutboxBacklogMonitorTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withBean(ChatEventOutboxRepository.class, () -> mock(ChatEventOutboxRepository.class))
        .withBean(ChatKafkaLagReader.class, () -> mock(ChatKafkaLagReader.class))
        .withBean(ChatEventPipelineMetrics.class, () -> mock(ChatEventPipelineMetrics.class))
        .withUserConfiguration(ChatOutboxBacklogMonitor.class);

    @Test
    void consumer만_활성화하면_monitor_bean을_생성하지_않는다() {
        runner.withPropertyValues(
            "chat.kafka.consumer.enabled=true",
            "chat.kafka.consumer.monitor-enabled=false")
            .run(context -> assertThat(context).doesNotHaveBean(ChatOutboxBacklogMonitor.class));
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
                verify(context.getBean(ChatEventPipelineMetrics.class)).activateCollector();
            });
    }
}
