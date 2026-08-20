package com.finalcall.domain.chat.listener;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.chat.dto.ChatEventResponse;
import com.finalcall.domain.chat.dto.ChatMessageResponse;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

/** 실제 로컬 수신자가 있는 fan-out event만 짧은 read-only transaction에서 hydrate한다. */
@Slf4j
@Component
@Transactional(readOnly = true)
public class ChatFanoutHydrator {

    private final ChatRoomRepository roomRepository;
    private final ChatMessageRepository messageRepository;
    private final UserRepository userRepository;

    public ChatFanoutHydrator(ChatRoomRepository roomRepository,
        ChatMessageRepository messageRepository,
        UserRepository userRepository) {
        this.roomRepository = roomRepository;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    public List<ChatFanoutDelivery> hydrate(ChatFanoutMetadata metadata, Set<Long> localRecipients) {
        ChatRoom room = roomRepository.findByPublicId(metadata.roomPublicId()).orElse(null);
        if (room == null || !matchesParticipants(room, metadata.recipientIds())) {
            log.warn("[ChatRealtime] Redis recipient가 DB 채팅방 참여자와 불일치해 폐기합니다. eventId={}",
                metadata.eventId());
            return List.of();
        }
        return switch (metadata.eventType()) {
            case MESSAGE_CREATED -> hydrateMessage(metadata, room, localRecipients);
            case READ_UPDATED -> hydrateRead(metadata, room, localRecipients);
            case BLOCK_CHANGED -> hydrateBlock(metadata, room, localRecipients);
            default -> throw new IllegalArgumentException("지원하지 않는 채팅 이벤트입니다.");
        };
    }

    private List<ChatFanoutDelivery> hydrateMessage(
        ChatFanoutMetadata metadata,
        ChatRoom room,
        Set<Long> localRecipients) {
        if (!ChatRedisFanoutListener.isUlid(metadata.messagePublicId())
            || metadata.roomSequence() == null
            || metadata.senderId() == null) {
            return List.of();
        }
        ChatMessage chatMessage = messageRepository.findByRoomIdAndPublicId(room.getId(), metadata.messagePublicId())
            .orElse(null);
        if (chatMessage == null
            || chatMessage.getRoomSequence() != metadata.roomSequence()
            || !chatMessage.getSenderId().equals(metadata.senderId())
            || !room.isParticipant(chatMessage.getSenderId())) {
            log.warn("[ChatRealtime] Redis message metadata가 DB 정본과 불일치해 폐기합니다. eventId={}",
                metadata.eventId());
            return List.of();
        }
        User sender = userRepository.findById(chatMessage.getSenderId()).orElse(null);
        if (sender == null) {
            return List.of();
        }
        List<ChatFanoutDelivery> deliveries = new ArrayList<>(localRecipients.size());
        for (Long recipientId : localRecipients) {
            ChatMessageResponse response = ChatMessageResponse.from(chatMessage, sender, recipientId);
            deliveries.add(new ChatFanoutDelivery(recipientId, ChatEventResponse.messageCreated(
                metadata.eventId(), metadata.eventVersion(), metadata.occurredAt(), metadata.roomPublicId(),
                response)));
        }
        return List.copyOf(deliveries);
    }

    private List<ChatFanoutDelivery> hydrateRead(
        ChatFanoutMetadata metadata,
        ChatRoom room,
        Set<Long> localRecipients) {
        if (metadata.readerId() == null
            || metadata.throughSequence() == null
            || metadata.throughSequence() < 0L
            || metadata.throughSequence() > room.getLastSequence()
            || !room.isParticipant(metadata.readerId())) {
            return List.of();
        }
        User reader = userRepository.findById(metadata.readerId()).orElse(null);
        if (reader == null) {
            return List.of();
        }
        ChatEventResponse response = ChatEventResponse.readUpdated(
            metadata.eventId(), metadata.eventVersion(), metadata.occurredAt(), metadata.roomPublicId(),
            reader.getPublicId(), metadata.throughSequence(), metadata.occurredAt());
        return localRecipients.stream().map(recipientId -> new ChatFanoutDelivery(recipientId, response)).toList();
    }

    private List<ChatFanoutDelivery> hydrateBlock(
        ChatFanoutMetadata metadata,
        ChatRoom room,
        Set<Long> localRecipients) {
        if (metadata.actorId() == null || metadata.changedAt() == null || !room.isParticipant(metadata.actorId())) {
            return List.of();
        }
        ChatEventResponse response = ChatEventResponse.blockChanged(
            metadata.eventId(), metadata.eventVersion(), metadata.occurredAt(), metadata.roomPublicId(),
            metadata.changedAt());
        return localRecipients.stream().map(recipientId -> new ChatFanoutDelivery(recipientId, response)).toList();
    }

    private boolean matchesParticipants(ChatRoom room, List<Long> recipientIds) {
        return Set.of(room.getMemberLowId(), room.getMemberHighId()).equals(new HashSet<>(recipientIds));
    }
}
