package com.finalcall.domain.chat.dto;

import lombok.Builder;

/** 현재 사용자의 전체 채팅 unread 합계. */
@Builder
public record ChatUnreadCountResponse(long count) {

    public static ChatUnreadCountResponse from(long count) {
        return ChatUnreadCountResponse.builder().count(count).build();
    }
}
