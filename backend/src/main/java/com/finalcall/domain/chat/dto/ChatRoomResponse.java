package com.finalcall.domain.chat.dto;

import java.time.Instant;

import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.entity.ChatRoomMemberState;
import com.finalcall.domain.member.entity.User;

import lombok.Builder;

/** 방 목록과 상세가 공유하는 현재 사용자 관점의 채팅방 응답. */
@Builder
public record ChatRoomResponse(
    String roomPublicId,
    Counterpart counterpart,
    LastMessage lastMessage,
    long lastSequence,
    long lastReadSequence,
    long counterpartLastReadSequence,
    long unreadCount,
    boolean blockedByMe,
    boolean canSend,
    Instant createdAt,
    Instant lastActivityAt) {

    private static final String DELETED_USER_NICKNAME = "탈퇴한 사용자";
    private static final int PREVIEW_MAX_CODE_POINTS = 80;

    public static ChatRoomResponse from(ChatRoom room, User counterpart, ChatRoomMemberState subjectState,
        ChatRoomMemberState counterpartState, ChatMessage lastMessage, boolean blockedByMe, boolean blocked) {
        long lastReadSequence = subjectState.getLastReadSequence();
        return ChatRoomResponse.builder()
            .roomPublicId(room.getPublicId())
            .counterpart(new Counterpart(counterpart.getPublicId(),
                counterpart.isDeleted() ? DELETED_USER_NICKNAME : counterpart.getNickname()))
            .lastMessage(lastMessage != null ? LastMessage.from(lastMessage) : null)
            .lastSequence(room.getLastSequence())
            .lastReadSequence(lastReadSequence)
            .counterpartLastReadSequence(counterpartState.getLastReadSequence())
            .unreadCount(Math.max(0L, room.getLastSequence() - lastReadSequence))
            .blockedByMe(blockedByMe)
            .canSend(!blocked && !counterpart.isDeleted())
            .createdAt(room.getCreatedAt())
            .lastActivityAt(room.getLastActivityAt())
            .build();
    }

    /** 상대 회원의 외부 식별자와 현재 표시명. */
    public record Counterpart(String memberPublicId, String nickname) {
    }

    /** 방 목록에 노출하는 마지막 보존 메시지 미리보기. */
    public record LastMessage(
        String messagePublicId,
        long roomSequence,
        String senderNickname,
        String bodyPreview,
        Instant createdAt) {

        private static LastMessage from(ChatMessage message) {
            return new LastMessage(message.getPublicId(), message.getRoomSequence(),
                message.getSenderNicknameSnapshot(), preview(message.getBody()), message.getCreatedAt());
        }

        private static String preview(String body) {
            int codePointCount = body.codePointCount(0, body.length());
            if (codePointCount <= PREVIEW_MAX_CODE_POINTS) {
                return body;
            }
            int end = body.offsetByCodePoints(0, PREVIEW_MAX_CODE_POINTS);
            return body.substring(0, end);
        }
    }
}
