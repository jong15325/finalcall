package com.finalcall.domain.chat.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.chat.listener.ChatEventPipelineMetrics;
import com.finalcall.domain.chat.listener.ChatKafkaLagReader;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;

/** outbox 크기와 전역 Kafka consumer group lag를 운영 설정 간격으로 관측한다. */
@Service
@ConditionalOnProperty(prefix = "chat.kafka.consumer", name = "monitor-enabled", havingValue = "true")
public class ChatOutboxBacklogMonitor {

    private final ChatEventOutboxRepository outboxRepository;
    private final ChatKafkaLagReader kafkaLagReader;
    private final ChatEventPipelineMetrics pipelineMetrics;

    public ChatOutboxBacklogMonitor(
        ChatEventOutboxRepository outboxRepository,
        ChatKafkaLagReader kafkaLagReader,
        ChatEventPipelineMetrics pipelineMetrics) {
        this.outboxRepository = outboxRepository;
        this.kafkaLagReader = kafkaLagReader;
        this.pipelineMetrics = pipelineMetrics;
        pipelineMetrics.activateCollector();
    }

    /** 네트워크 수집 중 DB transaction을 유지하지 않으며 실패 표본은 이전 정상 gauge를 보존한다. */
    @Scheduled(fixedDelayString = "${chat.kafka.consumer.monitor-interval:10s}")
    @ServiceLog
    public void measure() {
        try {
            pipelineMetrics.observeOutboxRows(outboxRepository.estimateRowCount());
            pipelineMetrics.observeConsumerLag(kafkaLagReader.read());
            pipelineMetrics.recordCollectionSuccess();
        } catch (RuntimeException ex) {
            pipelineMetrics.recordCollectionFailure();
            throw ex;
        }
    }
}
