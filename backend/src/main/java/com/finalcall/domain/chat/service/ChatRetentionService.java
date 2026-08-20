package com.finalcall.domain.chat.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.chat.config.ChatRetentionProperties;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatOutboxRetentionCheckpoint;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatOutboxRetentionCheckpointRepository;
import com.finalcall.domain.chat.repository.ChatReportRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** 짧은 독립 트랜잭션으로 채팅 보존 기한을 집행하는 서비스. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRetentionService {

    private final ChatRetentionProperties properties;
    private final ChatMessageRepository messageRepository;
    private final ChatRoomMemberStateRepository memberStateRepository;
    private final ChatReportRepository reportRepository;
    private final ChatEventOutboxRepository outboxRepository;
    private final ChatOutboxRetentionCheckpointRepository checkpointRepository;

    /** 180일을 지난 메시지를 소배치 삭제하고, 같은 TX에서 방별 삭제 최대 sequence까지 read floor를 먼저 전진시킨다. */
    @Transactional
    @ServiceLog
    public int purgeMessageBatch(Instant now) {
        Instant cutoff = now.minus(properties.messageAge());
        List<Long> ids = messageRepository.findRetentionIdsForUpdate(cutoff, properties.batchSize());
        if (ids.isEmpty()) {
            return 0;
        }

        Map<Long, Long> roomFloors = new HashMap<>();
        for (ChatMessage message : messageRepository.findAllById(ids)) {
            roomFloors.merge(message.getRoomId(), message.getRoomSequence(), Math::max);
        }
        roomFloors.forEach((roomId, floor) -> memberStateRepository.advanceRetentionFloor(roomId, floor, now));
        return messageRepository.deleteRetentionIds(ids);
    }

    /** 3년을 지난 신고와 증거 snapshot을 (created_at,id) 인덱스 순서로 소배치 물리 삭제한다. */
    @Transactional
    @ServiceLog
    public int purgeReportBatch(Instant now) {
        Instant cutoff = now.minus(properties.reportAge());
        List<Long> ids = reportRepository.findRetentionIdsForUpdate(cutoff, properties.batchSize());
        if (ids.isEmpty()) {
            return 0;
        }
        return reportRepository.deleteRetentionIds(ids);
    }

    /** 최신 CDC checkpoint와 충분한 MySQL binlog 보존을 모두 확인한 뒤 7일 초과 outbox만 소배치 삭제한다. */
    @Transactional
    @ServiceLog
    public int purgeOutboxBatch(Instant now) {
        ChatOutboxRetentionCheckpoint checkpoint = checkpointRepository
            .findById(ChatOutboxRetentionCheckpoint.SINGLETON_ID)
            .orElse(null);
        if (!hasFreshCheckpoint(checkpoint, now) || !hasEnoughBinlogRetention()) {
            return 0;
        }

        Instant cutoff = now.minus(properties.outboxAge());
        List<Long> ids = outboxRepository.findRetentionIdsForUpdate(
            cutoff, checkpoint.getCdcSafeOutboxId(), properties.batchSize());
        if (ids.isEmpty()) {
            return 0;
        }
        return outboxRepository.deleteRetentionIds(ids);
    }

    private boolean hasFreshCheckpoint(ChatOutboxRetentionCheckpoint checkpoint, Instant now) {
        if (checkpoint == null || checkpoint.getCdcSafeOutboxId() <= 0L) {
            log.warn("CDC 안전 checkpoint가 없어 채팅 outbox retention을 건너뛴다.");
            return false;
        }
        Instant oldestAllowed = now.minus(properties.cdcCheckpointMaxAge());
        if (checkpoint.getCdcCheckedAt().isBefore(oldestAllowed)
            || checkpoint.getCdcCheckedAt().isAfter(now)) {
            log.warn("CDC 안전 checkpoint가 유효 시간 밖이라 채팅 outbox retention을 건너뛴다.");
            return false;
        }
        return true;
    }

    private boolean hasEnoughBinlogRetention() {
        try {
            long actualSeconds = checkpointRepository.findBinlogExpireSeconds();
            long requiredSeconds = properties.requiredBinlogAge().getSeconds();
            if (actualSeconds < requiredSeconds) {
                log.warn("MySQL binlog 보존 여유가 부족해 채팅 outbox retention을 건너뛴다. requiredSeconds={}, actualSeconds={}",
                    requiredSeconds, actualSeconds);
                return false;
            }
            return true;
        } catch (RuntimeException ex) {
            log.warn("MySQL binlog 보존 설정을 확인하지 못해 채팅 outbox retention을 건너뛴다.", ex);
            return false;
        }
    }
}
