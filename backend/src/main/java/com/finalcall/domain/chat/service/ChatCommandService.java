package com.finalcall.domain.chat.service;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ChatErrorCode;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.common.util.Ulid;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.entity.ChatMessage;
import com.finalcall.domain.chat.entity.ChatReport;
import com.finalcall.domain.chat.entity.ChatReportReason;
import com.finalcall.domain.chat.entity.ChatRoom;
import com.finalcall.domain.chat.entity.ChatRoomMemberState;
import com.finalcall.domain.chat.entity.ChatUserBlock;
import com.finalcall.domain.chat.repository.ChatEventOutboxRepository;
import com.finalcall.domain.chat.repository.ChatMessageRepository;
import com.finalcall.domain.chat.repository.ChatReportRepository;
import com.finalcall.domain.chat.repository.ChatRoomMemberStateRepository;
import com.finalcall.domain.chat.repository.ChatRoomRepository;
import com.finalcall.domain.chat.repository.ChatUserBlockRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;

import lombok.RequiredArgsConstructor;

/**
 * 채팅 영속 명령 코어. MySQL 방 행 락과 같은 트랜잭션의 outbox만 정확성 경계로 사용한다.
 * Redis·Kafka·WebSocket은 이 서비스의 성공 여부에 관여하지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatCommandService {

    private static final int MAX_BODY_CODE_POINTS = 1000;
    private static final int MAX_BODY_UTF8_BYTES = 4000;
    private static final int MAX_REPORT_DETAIL_LENGTH = 500;

    private final ChatRoomRepository roomRepository;
    private final ChatRoomMemberStateRepository memberStateRepository;
    private final ChatMessageRepository messageRepository;
    private final ChatUserBlockRepository blockRepository;
    private final ChatReportRepository reportRepository;
    private final ChatEventOutboxRepository outboxRepository;
    private final UserRepository userRepository;
    private final ChatRateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    /** 활성 회원 닉네임으로 direct room을 생성하거나 정렬된 사용자 쌍의 기존 room을 재사용한다. */
    @Transactional
    @ServiceLog
    public ChatRoomCreation createDirectRoom(String counterpartNickname) {
        validateCounterpartNickname(counterpartNickname);
        Long requesterId = currentUserId();
        User requester = userRepository.findByIdAndIsDeletedFalse(requesterId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        User counterpart = userRepository.findByNicknameAndIsDeletedFalse(counterpartNickname)
            .orElseThrow(() -> new BusinessException(ChatErrorCode.CHAT_COUNTERPART_NOT_FOUND));
        Preconditions.validate(!requester.getId().equals(counterpart.getId()), ChatErrorCode.CHAT_SELF_DIRECT_ROOM);

        Long memberLowId = Math.min(requester.getId(), counterpart.getId());
        Long memberHighId = Math.max(requester.getId(), counterpart.getId());
        ChatRoom existing = roomRepository.findByMemberLowIdAndMemberHighId(memberLowId, memberHighId).orElse(null);
        if (existing != null) {
            return new ChatRoomCreation(existing, false);
        }
        Preconditions.validate(!blockRepository.existsBetween(memberLowId, memberHighId),
            ChatErrorCode.CHAT_UNAVAILABLE);

        Instant now = Instant.now();
        String candidatePublicId = Ulid.generate();
        roomRepository.insertDirectIfAbsent(candidatePublicId, memberLowId, memberHighId, now);
        ChatRoom room = roomRepository.findByMemberPairForUpdate(memberLowId, memberHighId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        boolean created = candidatePublicId.equals(room.getPublicId());
        if (created) {
            memberStateRepository.saveAll(List.of(
                ChatRoomMemberState.builder().roomId(room.getId()).userId(memberLowId).build(),
                ChatRoomMemberState.builder().roomId(room.getId()).userId(memberHighId).build()));
        }
        return new ChatRoomCreation(room, created);
    }

    /** 방 행 락 아래에서 순번을 배정하고 clientMessageId 멱등성·양방향 차단을 판정한다. */
    @Transactional
    @ServiceLog
    public ChatMessagePersistence sendMessage(String roomPublicId, String clientMessageId, String body) {
        validateClientMessageId(clientMessageId);
        String normalizedBody = normalizeBody(body);
        Long senderId = currentUserId();
        ChatRoom room = loadLockedRoom(roomPublicId, senderId);
        User sender = userRepository.findByIdAndIsDeletedFalse(senderId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        ChatMessage existing = messageRepository.findByRoomIdAndSenderIdAndClientMessageId(
            room.getId(), senderId, clientMessageId).orElse(null);
        if (existing != null) {
            Preconditions.validate(existing.getBody().equals(normalizedBody),
                ChatErrorCode.CHAT_IDEMPOTENCY_CONFLICT);
            return new ChatMessagePersistence(existing, sender.getPublicId(), true);
        }

        Long counterpartId = room.counterpartId(senderId);
        Preconditions.validate(userRepository.findByIdAndIsDeletedFalse(counterpartId).isPresent(),
            ChatErrorCode.CHAT_UNAVAILABLE);
        Preconditions.validate(!blockRepository.existsBetween(senderId, counterpartId),
            ChatErrorCode.CHAT_UNAVAILABLE);
        Instant now = Instant.now();
        long roomSequence = room.advanceSequence(now);
        ChatMessage message = messageRepository.save(ChatMessage.builder()
            .roomId(room.getId())
            .roomSequence(roomSequence)
            .senderId(senderId)
            .senderNicknameSnapshot(sender.getNickname())
            .clientMessageId(clientMessageId)
            .body(normalizedBody)
            .build());

        ChatRoomMemberState senderState = memberStateRepository.findByRoomIdAndUserId(room.getId(), senderId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        boolean readAdvanced = senderState.advanceReadTo(roomSequence, now);
        appendMessageCreated(room, message, now);
        if (readAdvanced) {
            appendReadUpdated(room, senderId, roomSequence, now);
        }
        return new ChatMessagePersistence(message, sender.getPublicId(), false);
    }

    /** 읽음 위치를 {@code max(current, throughSequence)}로만 전진시킨다. */
    @Transactional
    @ServiceLog
    public ChatRoomMemberState updateRead(String roomPublicId, long throughSequence) {
        Long readerId = currentUserId();
        ChatRoom room = loadLockedRoom(roomPublicId, readerId);
        Preconditions.validate(throughSequence >= 0 && throughSequence <= room.getLastSequence(),
            ChatErrorCode.CHAT_READ_SEQUENCE_INVALID);

        ChatRoomMemberState state = memberStateRepository.findByRoomIdAndUserId(room.getId(), readerId)
            .orElseThrow(() -> new BusinessException(CommonErrorCode.INTERNAL_ERROR));
        Instant now = Instant.now();
        if (state.advanceReadTo(throughSequence, now)) {
            appendReadUpdated(room, readerId, throughSequence, now);
        }
        return state;
    }

    /** 요청자가 만든 방향성 차단을 멱등 생성한다. send와 같은 room 락 순서를 사용한다. */
    @Transactional
    @ServiceLog
    public void block(String roomPublicId) {
        Long blockerId = currentUserId();
        ChatRoom room = loadLockedRoom(roomPublicId, blockerId);
        Long blockedId = room.counterpartId(blockerId);
        if (blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId).isPresent()) {
            return;
        }
        blockRepository.save(ChatUserBlock.builder().blockerId(blockerId).blockedId(blockedId).build());
        appendBlockChanged(room, blockerId, Instant.now());
    }

    /** 요청자가 만든 방향성 차단만 멱등 삭제한다. 상대 방향 차단은 유지한다. */
    @Transactional
    @ServiceLog
    public void unblock(String roomPublicId) {
        Long blockerId = currentUserId();
        ChatRoom room = loadLockedRoom(roomPublicId, blockerId);
        Long blockedId = room.counterpartId(blockerId);
        ChatUserBlock block = blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId).orElse(null);
        if (block == null) {
            return;
        }
        blockRepository.delete(block);
        appendBlockChanged(room, blockerId, Instant.now());
    }

    /** 같은 방 상대가 보낸 메시지만 신고하고 원문 purge와 독립된 증거 snapshot을 남긴다. */
    @Transactional
    @ServiceLog
    public ChatReport report(String roomPublicId, String messagePublicId, ChatReportReason reason, String detail) {
        Preconditions.validate(reason != null, CommonErrorCode.INVALID_INPUT);
        Preconditions.validate(detail == null || detail.length() <= MAX_REPORT_DETAIL_LENGTH,
            CommonErrorCode.INVALID_INPUT);
        Long reporterId = currentUserId();
        ChatRoom room = loadLockedRoom(roomPublicId, reporterId);
        ChatMessage message = messageRepository.findByRoomIdAndPublicIdForUpdate(room.getId(), messagePublicId)
            .orElseThrow(() -> new BusinessException(ChatErrorCode.CHAT_NOT_FOUND));
        Preconditions.validate(!reporterId.equals(message.getSenderId()),
            ChatErrorCode.CHAT_REPORT_TARGET_INVALID);
        Preconditions.validate(!reportRepository.existsByReporterIdAndMessagePublicId(reporterId, messagePublicId),
            ChatErrorCode.CHAT_REPORT_DUPLICATED);

        Instant now = Instant.now();
        rateLimitService.claimReportQuota(reporterId, now);

        return reportRepository.save(ChatReport.builder()
            .roomId(room.getId())
            .messageId(message.getId())
            .messagePublicId(message.getPublicId())
            .reporterId(reporterId)
            .reportedUserId(message.getSenderId())
            .reason(reason)
            .detail(detail)
            .messageBodySnapshot(message.getBody())
            .senderNicknameSnapshot(message.getSenderNicknameSnapshot())
            .build());
    }

    private ChatRoom loadLockedRoom(String roomPublicId, Long subjectId) {
        ChatRoom room = roomRepository.findByPublicIdForUpdate(roomPublicId)
            .orElseThrow(() -> new BusinessException(ChatErrorCode.CHAT_NOT_FOUND));
        Preconditions.validate(room.isParticipant(subjectId), ChatErrorCode.CHAT_NOT_FOUND);
        return room;
    }

    private void appendMessageCreated(ChatRoom room, ChatMessage message, Instant occurredAt) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("roomPublicId", room.getPublicId());
        metadata.put("messagePublicId", message.getPublicId());
        metadata.put("roomSequence", message.getRoomSequence());
        metadata.put("senderId", message.getSenderId());
        metadata.put("recipientIds", List.of(room.getMemberLowId(), room.getMemberHighId()));
        metadata.put("occurredAt", occurredAt.toString());
        appendOutbox(room, ChatEventType.MESSAGE_CREATED, metadata, occurredAt);
    }

    private void appendReadUpdated(ChatRoom room, Long readerId, long throughSequence, Instant occurredAt) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("roomPublicId", room.getPublicId());
        metadata.put("readerId", readerId);
        metadata.put("throughSequence", throughSequence);
        metadata.put("recipientIds", List.of(room.getMemberLowId(), room.getMemberHighId()));
        metadata.put("occurredAt", occurredAt.toString());
        appendOutbox(room, ChatEventType.READ_UPDATED, metadata, occurredAt);
    }

    private void appendBlockChanged(ChatRoom room, Long actorId, Instant occurredAt) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("roomPublicId", room.getPublicId());
        metadata.put("actorId", actorId);
        metadata.put("recipientIds", List.of(room.getMemberLowId(), room.getMemberHighId()));
        metadata.put("changedAt", occurredAt.toString());
        appendOutbox(room, ChatEventType.BLOCK_CHANGED, metadata, occurredAt);
    }

    private void appendOutbox(ChatRoom room, ChatEventType eventType, Map<String, Object> metadata,
        Instant occurredAt) {
        String eventId = Ulid.generate();
        metadata.put("eventId", eventId);
        try {
            outboxRepository.save(ChatEventOutbox.builder()
                .eventId(eventId)
                .aggregateId(room.getPublicId())
                .eventType(eventType)
                .payload(objectMapper.writeValueAsString(metadata))
                .occurredAt(occurredAt)
                .build());
        } catch (JsonProcessingException ex) {
            throw new BusinessException(CommonErrorCode.INTERNAL_ERROR);
        }
    }

    private String normalizeBody(String body) {
        Preconditions.validate(body != null, CommonErrorCode.INVALID_INPUT);
        String normalized = Normalizer.normalize(body, Normalizer.Form.NFC);
        Preconditions.validate(!normalized.isBlank(), CommonErrorCode.INVALID_INPUT);
        Preconditions.validate(normalized.codePointCount(0, normalized.length()) <= MAX_BODY_CODE_POINTS,
            CommonErrorCode.INVALID_INPUT);
        Preconditions.validate(normalized.getBytes(StandardCharsets.UTF_8).length <= MAX_BODY_UTF8_BYTES,
            CommonErrorCode.INVALID_INPUT);
        for (int offset = 0; offset < normalized.length();) {
            int codePoint = normalized.codePointAt(offset);
            Preconditions.validate(codePoint >= 0x20 || codePoint == '\n' || codePoint == '\t',
                CommonErrorCode.INVALID_INPUT);
            offset += Character.charCount(codePoint);
        }
        return normalized;
    }

    private void validateClientMessageId(String clientMessageId) {
        Preconditions.validate(clientMessageId != null && clientMessageId.length() == 36,
            CommonErrorCode.INVALID_INPUT);
        try {
            UUID parsed = UUID.fromString(clientMessageId);
            Preconditions.validate(parsed.version() == 4 && parsed.variant() == 2
                && parsed.toString().equals(clientMessageId), CommonErrorCode.INVALID_INPUT);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }

    private void validateCounterpartNickname(String counterpartNickname) {
        Preconditions.validate(counterpartNickname != null && !counterpartNickname.isBlank()
            && counterpartNickname.length() <= 30, CommonErrorCode.INVALID_INPUT);
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
