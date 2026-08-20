package com.finalcall.domain.chat.dto;

import java.time.Instant;

import com.finalcall.domain.chat.entity.ChatEventType;

import lombok.Builder;

/** STOMP user destination으로만 전달하는 versioned 채팅 실시간 event envelope. */
@Builder
public record ChatEventResponse(
    String eventId,
    ChatEventType eventType,
    int eventVersion,
    Instant occurredAt,
    String roomPublicId,
    Object payload) {

    public static ChatEventResponse messageCreated(String eventId, int eventVersion, Instant occurredAt,
        String roomPublicId, ChatMessageResponse message) {
        return ChatEventResponse.builder()
            .eventId(eventId)
            .eventType(ChatEventType.MESSAGE_CREATED)
            .eventVersion(eventVersion)
            .occurredAt(occurredAt)
            .roomPublicId(roomPublicId)
            .payload(new MessagePayload(message))
            .build();
    }

    public static ChatEventResponse readUpdated(String eventId, int eventVersion, Instant occurredAt,
        String roomPublicId, String readerMemberPublicId, long throughSequence, Instant readAt) {
        return ChatEventResponse.builder()
            .eventId(eventId)
            .eventType(ChatEventType.READ_UPDATED)
            .eventVersion(eventVersion)
            .occurredAt(occurredAt)
            .roomPublicId(roomPublicId)
            .payload(new ReadPayload(readerMemberPublicId, throughSequence, readAt))
            .build();
    }

    public static ChatEventResponse blockChanged(String eventId, int eventVersion, Instant occurredAt,
        String roomPublicId, Instant changedAt) {
        return ChatEventResponse.builder()
            .eventId(eventId)
            .eventType(ChatEventType.BLOCK_CHANGED)
            .eventVersion(eventVersion)
            .occurredAt(occurredAt)
            .roomPublicId(roomPublicId)
            .payload(new BlockPayload(changedAt))
            .build();
    }

    public record MessagePayload(ChatMessageResponse message) {
    }

    public record ReadPayload(String readerMemberPublicId, long throughSequence, Instant readAt) {
    }

    public record BlockPayload(Instant changedAt) {
    }
}
