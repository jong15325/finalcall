package com.finalcall.domain.chat.listener;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.realtime.ChatStompAuthorizationInterceptor;
import com.finalcall.domain.chat.realtime.ChatWebSocketSessionRegistry;

import lombok.extern.slf4j.Slf4j;

/** Redis metadata를 검증하고 로컬 수신자가 있는 이벤트만 hydration에 전달한다. */
@Slf4j
@Component
public class ChatRedisFanoutListener implements MessageListener {

    private static final Pattern ULID_PATTERN = Pattern.compile("[0-7][0-9A-HJKMNP-TV-Z]{25}");
    private static final String USER_DESTINATION = ChatStompAuthorizationInterceptor.USER_CHAT_DESTINATION
        .substring("/user".length());

    private final ObjectMapper objectMapper;
    private final ChatWebSocketSessionRegistry sessionRegistry;
    private final ChatFanoutEventDeduplicator eventDeduplicator;
    private final ChatFanoutHydrator fanoutHydrator;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatRedisFanoutListener(ObjectMapper objectMapper,
        ChatWebSocketSessionRegistry sessionRegistry,
        ChatFanoutEventDeduplicator eventDeduplicator,
        ChatFanoutHydrator fanoutHydrator,
        SimpMessagingTemplate messagingTemplate) {
        this.objectMapper = objectMapper;
        this.sessionRegistry = sessionRegistry;
        this.eventDeduplicator = eventDeduplicator;
        this.fanoutHydrator = fanoutHydrator;
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    @ServiceLog(slowMs = 500L)
    public void onMessage(Message message, byte[] pattern) {
        try {
            ChatFanoutMetadata metadata = objectMapper.readValue(
                new String(message.getBody(), StandardCharsets.UTF_8), ChatFanoutMetadata.class);
            if (!isValidEnvelope(metadata)) {
                log.warn("[ChatRealtime] 유효하지 않은 Redis fan-out metadata를 폐기합니다.");
                return;
            }
            Set<Long> localRecipients = sessionRegistry.localRecipients(metadata.recipientIds());
            if (localRecipients.isEmpty() || !eventDeduplicator.claim(metadata.eventId())) {
                return;
            }
            processClaimed(metadata, localRecipients);
        } catch (Exception ex) {
            log.warn("[ChatRealtime] Redis fan-out 처리 실패를 무시합니다. REST replay로 복구합니다.", ex);
        }
    }

    private void processClaimed(ChatFanoutMetadata metadata, Set<Long> localRecipients) {
        try {
            for (ChatFanoutDelivery delivery : fanoutHydrator.hydrate(metadata, localRecipients)) {
                messagingTemplate.convertAndSendToUser(
                    String.valueOf(delivery.recipientId()), USER_DESTINATION, delivery.response());
            }
            eventDeduplicator.complete(metadata.eventId());
        } catch (RuntimeException ex) {
            eventDeduplicator.release(metadata.eventId());
            throw ex;
        }
    }

    private boolean isValidEnvelope(ChatFanoutMetadata metadata) {
        if (metadata == null
            || metadata.eventVersion() != ChatEventOutbox.EVENT_VERSION
            || metadata.eventType() == null
            || metadata.occurredAt() == null
            || !isUlid(metadata.eventId())
            || !isUlid(metadata.roomPublicId())
            || metadata.recipientIds() == null
            || metadata.recipientIds().size() != 2
            || metadata.recipientIds().stream().anyMatch(id -> id == null || id <= 0L)) {
            return false;
        }
        return new HashSet<>(metadata.recipientIds()).size() == 2;
    }

    static boolean isUlid(String value) {
        return value != null && ULID_PATTERN.matcher(value).matches();
    }
}
