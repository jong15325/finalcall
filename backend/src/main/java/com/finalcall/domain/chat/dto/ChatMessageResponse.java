package com.finalcall.domain.chat.dto;

import java.time.Instant;

import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/** roomSequence 순서가 권위인 채팅 메시지 응답. */
@Builder
public record ChatMessageResponse(
    String messagePublicId,
    String clientMessageId,
    long roomSequence,
    Sender sender,
    String body,
    boolean sentByMe,
    Instant createdAt) {

    public static ChatMessageResponse from(ChatMessage message, User sender, Long subjectId) {
        return ChatMessageResponse.builder()
            .messagePublicId(message.getPublicId())
            .clientMessageId(message.getClientMessageId())
            .roomSequence(message.getRoomSequence())
            .sender(new Sender(sender.getPublicId(), message.getSenderNicknameSnapshot()))
            .body(message.getBody())
            .sentByMe(message.getSenderId().equals(subjectId))
            .createdAt(message.getCreatedAt())
            .build();
    }

    /** 발신자 내부 PK를 숨긴 외부 표시 형상. */
    public record Sender(String memberPublicId, String nickname) {
    }
}
