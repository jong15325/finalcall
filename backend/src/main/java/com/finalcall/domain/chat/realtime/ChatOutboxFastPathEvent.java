package com.finalcall.domain.chat.realtime;

/** worker 경계 전에 allowlist 직렬화를 마친 Redis metadata-only snapshot. */
public record ChatOutboxFastPathEvent(String eventId, String metadataJson) {
}
