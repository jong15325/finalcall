package com.finalcall.domain.chat.repository;

import java.util.Collection;
import java.util.List;

import com.finalcall.domain.chat.entity.ChatMessage;

/** REST 메시지 replay와 방 목록 마지막 메시지를 위한 QueryDSL 계약. */
public interface ChatMessageRepositoryCustom {

    List<ChatMessage> findPage(Long roomId, Long beforeSequence, Long afterSequence, int size);

    List<ChatMessage> findLatestRetainedByRoomIds(Collection<Long> roomIds);
}
