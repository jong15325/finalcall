package com.finalcall.domain.chat.repository;

import java.time.Instant;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatRoom;

/** REST 방 목록과 전체 unread를 위한 채팅방 QueryDSL 계약. */
public interface ChatRoomRepositoryCustom {

    List<ChatRoom> findParticipantRoomsByCursor(Long userId, Instant cursorActivityAt, Long cursorId, int size);

    long sumUnreadByUserId(Long userId);
}
