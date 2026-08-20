package com.finalcall.domain.chat.listener;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatEventType;

/** Redis/Kafka에 원문 없이 흐르는 versioned 채팅 fan-out metadata. */
public record ChatFanoutMetadata(
    String eventId,
    ChatEventType eventType,
    int eventVersion,
    Instant occurredAt,
    String roomPublicId,
    List<Long> recipientIds,
    String messagePublicId,
    Long roomSequence,
    Long senderId,
    Long readerId,
    Long throughSequence,
    Long actorId,
    Instant changedAt) {
}
