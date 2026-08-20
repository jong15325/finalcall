package com.finalcall.domain.chat.service;

import com.finalcall.domain.chat.entity.ChatRoom;

/** direct room 생성 시 신규 생성 여부와 권위 room을 함께 반환하는 서비스 값. */
public record ChatRoomCreation(ChatRoom room, boolean created) {
}
