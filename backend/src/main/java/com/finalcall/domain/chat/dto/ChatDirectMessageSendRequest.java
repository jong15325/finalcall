package com.finalcall.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 상대 회원과의 첫 메시지를 전송하는 요청. */
public record ChatDirectMessageSendRequest(
    @NotBlank @Size(max = 30) String counterpartNickname,
    @NotBlank String clientMessageId,
    @NotBlank String body) {
}
