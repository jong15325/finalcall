package com.finalcall.domain.chat.dto;

import lombok.Builder;

/** direct room 생성 또는 재사용과 첫 메시지 전송을 함께 반환하는 응답. */
@Builder
public record ChatDirectMessageSendResponse(
    ChatRoomResponse room,
    ChatMessageResponse message,
    boolean roomCreated,
    boolean deduplicated) {

    public static ChatDirectMessageSendResponse from(ChatRoomResponse room, ChatMessageResponse message,
        boolean roomCreated, boolean deduplicated) {
        return ChatDirectMessageSendResponse.builder()
            .room(room)
            .message(message)
            .roomCreated(roomCreated)
            .deduplicated(deduplicated)
            .build();
    }
}
