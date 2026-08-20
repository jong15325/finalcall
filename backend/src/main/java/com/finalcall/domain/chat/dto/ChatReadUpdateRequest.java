package com.finalcall.domain.chat.dto;

import jakarta.validation.constraints.PositiveOrZero;

/** 채팅방 읽음 위치를 단조 전진시키는 요청. */
public record ChatReadUpdateRequest(
    @PositiveOrZero long throughSequence) {
}
