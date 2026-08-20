package com.finalcall.domain.chat.dto;

import com.finalcall.domain.chat.entity.ChatReportReason;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 같은 방 상대가 보낸 메시지를 신고하는 요청. */
public record ChatReportCreateRequest(
    @NotBlank @Size(max = 26) String messagePublicId,
    @NotNull ChatReportReason reason,
    @Size(max = 500) String detail) {
}
