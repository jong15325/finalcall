package com.finalcall.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** client UUID v4 멱등 키와 원문 텍스트를 받는 메시지 전송 요청. */
public record ChatMessageSendRequest(
    @NotBlank @Pattern(regexp = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}"
        + "-[89ab][0-9a-f]{3}-[0-9a-f]{12}") String clientMessageId,
    @NotBlank String body) {
}
