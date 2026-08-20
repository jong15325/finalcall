package com.finalcall.domain.chat.dto;

import lombok.Builder;

/** 메시지와 clientMessageId 멱등 재확인 여부를 함께 반환한다. */
@Builder
public record ChatMessageSendResponse(
    ChatMessageResponse message,
    boolean deduplicated) {

    public static ChatMessageSendResponse from(ChatMessageResponse message, boolean deduplicated) {
        return ChatMessageSendResponse.builder()
            .message(message)
            .deduplicated(deduplicated)
            .build();
    }
}
