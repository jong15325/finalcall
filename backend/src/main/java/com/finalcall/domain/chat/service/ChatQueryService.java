package com.finalcall.domain.chat.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ChatErrorCode;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.chat.dto.ChatMessageResponse;
import com.finalcall.domain.chat.dto.ChatRoomResponse;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.entity.ChatRoomMemberState;
import com.finalcall.domain.chat.entity.ChatUserBlock;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.chat.repository.ChatUserBlockRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/** SecurityContext 주체 관점의 채팅방·메시지 REST 조회 서비스. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatQueryService {

    private final ChatRoomRepository roomRepository;
    private final ChatRoomMemberStateRepository memberStateRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatUserBlockRepository blockRepository;
    private final UserRepository userRepository;

    /** 내 방 목록을 안정 keyset cursor로 조회한다. */
    @ServiceLog
    public CursorResponse<ChatRoomResponse, String> getRooms(String cursor, int size) {
        Long subjectId = currentUserId();
        ChatRoomCursor decoded = ChatRoomCursor.decode(cursor);
        List<ChatRoom> fetched = roomRepository.findParticipantRoomsByCursor(subjectId,
            decoded.lastActivityAt(), decoded.id(), size);
        boolean hasNext = fetched.size() > size;
        List<ChatRoom> page = hasNext ? fetched.subList(0, size) : fetched;
        List<ChatRoomResponse> content = buildRoomResponses(page, subjectId);
        String nextCursor = page.isEmpty() ? null : encodeCursor(page.getLast());
        return CursorResponse.of(content, nextCursor, hasNext);
    }

    /** 참여자 검증 뒤 한 방의 현재 상태를 조회한다. 미존재·비참여는 같은 CHAT_001이다. */
    @ServiceLog
    public ChatRoomResponse getRoom(String roomPublicId) {
        Long subjectId = currentUserId();
        ChatRoom room = loadParticipantRoom(roomPublicId, subjectId);
        return buildRoomResponses(List.of(room), subjectId).getFirst();
    }

    /** 모든 참여 방의 권위 unread 합계를 반환한다. */
    @ServiceLog
    public long getUnreadCount() {
        return roomRepository.sumUnreadByUserId(currentUserId());
    }

    /** 최신/과거/gap 모드 모두 roomSequence ASC 응답으로 정규화한다. */
    @ServiceLog
    public CursorResponse<ChatMessageResponse, Long> getMessages(String roomPublicId, Long beforeSequence,
        Long afterSequence, int size) {
        Preconditions.validate(beforeSequence == null || afterSequence == null, CommonErrorCode.INVALID_INPUT);
        Preconditions.validate(beforeSequence == null || beforeSequence >= 0L, CommonErrorCode.INVALID_INPUT);
        Preconditions.validate(afterSequence == null || afterSequence >= 0L, CommonErrorCode.INVALID_INPUT);

        Long subjectId = currentUserId();
        ChatRoom room = loadParticipantRoom(roomPublicId, subjectId);
        List<ChatMessage> fetched = messageRepository.findPage(room.getId(), beforeSequence, afterSequence, size);
        boolean hasNext = fetched.size() > size;
        List<ChatMessage> page = new ArrayList<>(hasNext ? fetched.subList(0, size) : fetched);
        if (afterSequence == null) {
            Collections.reverse(page);
        }
        List<ChatMessageResponse> content = mapMessages(page, subjectId);
        Long nextCursor = page.isEmpty() ? null
            : afterSequence != null ? page.getLast().getRoomSequence() : page.getFirst().getRoomSequence();
        return CursorResponse.of(content, nextCursor, hasNext);
    }

    /** 명령 서비스가 반환한 메시지를 같은 REST 표현으로 변환한다. */
    @ServiceLog
    public ChatMessageResponse getMessageResponse(ChatMessage message) {
        Long subjectId = currentUserId();
        return mapMessages(List.of(message), subjectId).getFirst();
    }

    private List<ChatRoomResponse> buildRoomResponses(List<ChatRoom> rooms, Long subjectId) {
        if (rooms.isEmpty()) {
            return List.of();
        }
        List<Long> roomIds = rooms.stream().map(ChatRoom::getId).toList();
        Map<Long, Map<Long, ChatRoomMemberState>> statesByRoom = new HashMap<>();
        for (ChatRoomMemberState state : memberStateRepository.findByRoomIdIn(roomIds)) {
            statesByRoom.computeIfAbsent(state.getRoomId(), ignored -> new HashMap<>())
                .put(state.getUserId(), state);
        }

        List<Long> counterpartIds = rooms.stream().map(room -> room.counterpartId(subjectId)).distinct().toList();
        Map<Long, User> users = userRepository.findAllById(counterpartIds).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<Long, ChatMessage> lastMessages = messageRepository.findLatestRetainedByRoomIds(roomIds).stream()
            .collect(Collectors.toMap(ChatMessage::getRoomId, Function.identity()));
        List<ChatUserBlock> blocks = blockRepository.findBetweenUserAndCounterparts(subjectId, counterpartIds);

        return rooms.stream().map(room -> {
            Long counterpartId = room.counterpartId(subjectId);
            Map<Long, ChatRoomMemberState> roomStates = statesByRoom.getOrDefault(room.getId(), Map.of());
            ChatRoomMemberState subjectState = required(roomStates.get(subjectId));
            ChatRoomMemberState counterpartState = required(roomStates.get(counterpartId));
            User counterpart = required(users.get(counterpartId));
            boolean blockedByMe = blocks.stream().anyMatch(block -> block.getBlockerId().equals(subjectId)
                && block.getBlockedId().equals(counterpartId));
            boolean blocked = blocks.stream().anyMatch(block -> isBetween(block, subjectId, counterpartId));
            return ChatRoomResponse.from(room, counterpart, subjectState, counterpartState,
                lastMessages.get(room.getId()), blockedByMe, blocked);
        }).toList();
    }

    private List<ChatMessageResponse> mapMessages(List<ChatMessage> messages, Long subjectId) {
        if (messages.isEmpty()) {
            return List.of();
        }
        List<Long> senderIds = messages.stream().map(ChatMessage::getSenderId).distinct().toList();
        Map<Long, User> senders = userRepository.findAllById(senderIds).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
        return messages.stream()
            .map(message -> ChatMessageResponse.from(message, required(senders.get(message.getSenderId())), subjectId))
            .toList();
    }

    private ChatRoom loadParticipantRoom(String roomPublicId, Long subjectId) {
        ChatRoom room = roomRepository.findByPublicId(roomPublicId)
            .orElseThrow(() -> new BusinessException(ChatErrorCode.CHAT_NOT_FOUND));
        Preconditions.validate(room.isParticipant(subjectId), ChatErrorCode.CHAT_NOT_FOUND);
        return room;
    }

    private boolean isBetween(ChatUserBlock block, Long firstId, Long secondId) {
        return block.getBlockerId().equals(firstId) && block.getBlockedId().equals(secondId)
            || block.getBlockerId().equals(secondId) && block.getBlockedId().equals(firstId);
    }

    private String encodeCursor(ChatRoom room) {
        return ChatRoomCursor.encode(room.getLastActivityAt(), room.getId());
    }

    private <T> T required(T value) {
        if (value == null) {
            throw new BusinessException(CommonErrorCode.INTERNAL_ERROR);
        }
        return value;
    }

    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        }
    }
}
