package com.finalcall.domain.chat.listener;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.MultiGauge;
import io.micrometer.core.instrument.Tags;

/** 전역 Kafka consumer group offset과 outbox 크기를 저카디널리티 gauge로 노출한다. */
@Component
public class ChatEventPipelineMetrics {

    private final AtomicLong outboxRows = new AtomicLong();
    private final MultiGauge consumerLag;
    private final MultiGauge consumerLagDuration;
    private final Counter collectionFailures;
    private final AtomicLong lastCollectionSuccessNanos = new AtomicLong(-1L);
    private final AtomicBoolean collectorActive = new AtomicBoolean();
    private final MeterRegistry meterRegistry;
    private final LongSupplier nanoTime;

    public ChatEventPipelineMetrics(MeterRegistry meterRegistry) {
        this(meterRegistry, System::nanoTime);
    }

    ChatEventPipelineMetrics(MeterRegistry meterRegistry, LongSupplier nanoTime) {
        this.meterRegistry = meterRegistry;
        this.nanoTime = nanoTime;
        Gauge.builder("chat.outbox.rows", outboxRows, AtomicLong::doubleValue)
            .description("보존 중인 채팅 outbox 행 수")
            .baseUnit("rows")
            .register(meterRegistry);
        this.consumerLag = MultiGauge.builder("chat.kafka.consumer.lag")
            .description("consumer group partition별 미소비 record 수")
            .baseUnit("records")
            .register(meterRegistry);
        this.consumerLagDuration = MultiGauge.builder("chat.kafka.consumer.lag.duration")
            .description("consumer group partition별 가장 오래된 미소비 record 지연")
            .baseUnit("seconds")
            .register(meterRegistry);
        this.collectionFailures = Counter.builder("chat.kafka.consumer.lag.collection.failures")
            .description("Kafka consumer group lag 수집 실패 횟수")
            .register(meterRegistry);
    }

    /** active collector에서만 stale 판정용 gauge를 등록한다. */
    public void activateCollector() {
        if (!collectorActive.compareAndSet(false, true)) {
            return;
        }
        Gauge.builder("chat.kafka.consumer.lag.collection.age", this,
            metrics -> metrics.collectionAgeSeconds())
            .description("마지막 Kafka consumer group lag 수집 성공 이후 경과 시간")
            .baseUnit("seconds")
            .register(meterRegistry);
    }

    public void observeOutboxRows(long rows) {
        outboxRows.set(Math.max(0L, rows));
    }

    public void observeConsumerLag(List<ChatKafkaPartitionLag> partitionLags) {
        List<MultiGauge.Row<?>> recordRows = partitionLags
            .stream().<MultiGauge.Row<?>>map(lag -> MultiGauge.Row.of(partitionTag(lag), lag.records()))
            .toList();
        List<MultiGauge.Row<?>> durationRows = partitionLags.stream().<MultiGauge.Row<?>>map(
            lag -> MultiGauge.Row.of(partitionTag(lag), lag.duration().toMillis() / 1_000.0))
            .toList();
        consumerLag.register(recordRows, true);
        consumerLagDuration.register(durationRows, true);
    }

    public void recordCollectionFailure() {
        collectionFailures.increment();
    }

    public void recordCollectionSuccess() {
        lastCollectionSuccessNanos.set(nanoTime.getAsLong());
    }

    private double collectionAgeSeconds() {
        long lastSuccessNanos = lastCollectionSuccessNanos.get();
        if (lastSuccessNanos < 0L) {
            return Double.NaN;
        }
        long elapsedNanos = Math.max(0L, nanoTime.getAsLong() - lastSuccessNanos);
        return elapsedNanos / 1_000_000_000.0;
    }

    private Tags partitionTag(ChatKafkaPartitionLag lag) {
        return Tags.of("partition", String.valueOf(lag.partition()));
    }
}
