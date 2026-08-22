package com.finalcall.domain.chat.service;

import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatRoom;

/** direct room 생성 또는 재사용과 메시지 영속화 결과. */
public record ChatDirectMessagePersistence(
    ChatRoom room,
    ChatMessage message,
    String senderPublicId,
    int senderPrimaryCharacterId,
    boolean roomCreated,
    boolean deduplicated) {

    public ChatDirectMessagePersistence(ChatRoom room, ChatMessage message, String senderPublicId,
        boolean roomCreated, boolean deduplicated) {
        this(room, message, senderPublicId, 1, roomCreated, deduplicated);
    }
}
