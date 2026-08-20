package com.finalcall.domain.chat.dto;

import java.time.Instant;

import com.finalcall.domain.chat.entity.ChatRoomMemberState;

import lombok.Builder;

/** 단조 갱신 뒤의 권위 읽음 위치. */
@Builder
public record ChatReadResponse(
    long lastReadSequence,
    Instant readAt) {

    public static ChatReadResponse from(ChatRoomMemberState state) {
        return ChatReadResponse.builder()
            .lastReadSequence(state.getLastReadSequence())
            .readAt(state.getLastReadAt())
            .build();
    }
}
