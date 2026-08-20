package com.finalcall.domain.chat.listener;

import java.time.Duration;

/** consumer group의 partition별 committed/end offset 차이와 첫 미소비 record 지연. */
public record ChatKafkaPartitionLag(int partition, long records, Duration duration) {
}
