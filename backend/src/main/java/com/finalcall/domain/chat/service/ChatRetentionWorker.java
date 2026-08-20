package com.finalcall.domain.chat.service;

import java.time.Instant;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.chat.config.ChatRetentionProperties;

import lombok.RequiredArgsConstructor;

/** 메시지·신고·outbox를 데이터 종류별 독립 소배치 트랜잭션으로 정리하는 worker. */
@Component
@RequiredArgsConstructor
public class ChatRetentionWorker {

    private final ChatRetentionProperties properties;
    private final ChatRetentionService retentionService;

    /** 운영 스케줄 진입점. 통합 테스트는 enabled=false로 끄고 {@link #sweepOnce}를 직접 호출한다. */
    @Scheduled(fixedDelayString = "${chat.retention.fixed-delay-ms:60000}")
    public void sweep() {
        if (!properties.enabled()) {
            return;
        }
        sweepOnce();
    }

    /** 같은 기준 시각으로 세 보존 기한을 한 소배치씩 처리한다. 각 호출은 별도 서비스 빈의 짧은 TX다. */
    public int sweepOnce() {
        return sweepOnce(Instant.now());
    }

    /** 테스트가 경계 시각을 결정적으로 주입하는 한 tick 진입점. */
    public int sweepOnce(Instant now) {
        int purged = retentionService.purgeMessageBatch(now);
        purged += retentionService.purgeReportBatch(now);
        purged += retentionService.purgeOutboxBatch(now);
        return purged;
    }
}
