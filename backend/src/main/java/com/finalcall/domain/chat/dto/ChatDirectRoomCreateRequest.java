package com.finalcall.domain.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 활성 회원 nickname으로 direct room을 만들거나 재사용하는 요청. */
public record ChatDirectRoomCreateRequest(
    @NotBlank @Size(max = 30) String counterpartNickname) {
}
