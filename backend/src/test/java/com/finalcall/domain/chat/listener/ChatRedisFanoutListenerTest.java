package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.finalcall.domain.chat.dto.ChatEventResponse;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;
import com.finalcall.domain.chat.realtime.ChatWebSocketSessionRegistry;

class ChatRedisFanoutListenerTest {

    private static final String EVENT_ID = "01H00000000000000000000000";
    private static final String ROOM_PUBLIC_ID = "01H00000000000000000000001";
    private static final String MESSAGE_PUBLIC_ID = "01H00000000000000000000002";
    private static final Instant OCCURRED_AT = Instant.parse("2026-08-18T00:00:00Z");

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final ChatWebSocketSessionRegistry sessionRegistry = org.mockito.Mockito
        .mock(ChatWebSocketSessionRegistry.class);
    private final ChatFanoutHydrator fanoutHydrator = org.mockito.Mockito.mock(ChatFanoutHydrator.class);
    private final SimpMessagingTemplate messagingTemplate = org.mockito.Mockito.mock(SimpMessagingTemplate.class);

    private ChatRedisFanoutListener listener;

    @BeforeEach
    void setUp() {
        listener = new ChatRedisFanoutListener(objectMapper, sessionRegistry,
            new ChatFanoutEventDeduplicator(), fanoutHydrator, messagingTemplate);
    }

    @Test
    void local_session이_없는_node는_transactional_hydrator를_호출하지_않는다() throws Exception {
        ChatFanoutMetadata metadata = messageMetadata();
        when(sessionRegistry.localRecipients(metadata.recipientIds())).thenReturn(Set.of());

        listener.onMessage(redisMessage(metadata), null);

        assertThat(ChatRedisFanoutListener.class.getAnnotation(Transactional.class)).isNull();
        verify(fanoutHydrator, never()).hydrate(metadata, Set.of());
    }

    @Test
    void Redis와_Kafka가_같은_event를_전달해도_hydrate는_한번만_수행한다() throws Exception {
        ChatFanoutMetadata metadata = messageMetadata();
        Set<Long> localRecipients = Set.of(1L, 2L);
        when(sessionRegistry.localRecipients(metadata.recipientIds())).thenReturn(localRecipients);
        when(fanoutHydrator.hydrate(metadata, localRecipients)).thenReturn(List.of());

        listener.onMessage(redisMessage(metadata), null);
        listener.onMessage(redisMessage(metadata), null);

        verify(fanoutHydrator, times(1)).hydrate(metadata, localRecipients);
    }

    @Test
    void hydration_실패는_claim을_release해_Kafka_fallback이_재시도한다() throws Exception {
        ChatFanoutMetadata metadata = messageMetadata();
        Set<Long> localRecipients = Set.of(1L, 2L);
        when(sessionRegistry.localRecipients(metadata.recipientIds())).thenReturn(localRecipients);
        when(fanoutHydrator.hydrate(metadata, localRecipients))
            .thenThrow(new IllegalStateException("DB timeout"))
            .thenReturn(List.of());

        listener.onMessage(redisMessage(metadata), null);
        listener.onMessage(redisMessage(metadata), null);

        verify(fanoutHydrator, times(2)).hydrate(metadata, localRecipients);
    }

    @Test
    void dispatch_실패도_claim을_release해_Kafka_fallback이_재시도한다() throws Exception {
        ChatFanoutMetadata metadata = messageMetadata();
        Set<Long> localRecipients = Set.of(1L);
        ChatEventResponse response = org.mockito.Mockito.mock(ChatEventResponse.class);
        when(sessionRegistry.localRecipients(metadata.recipientIds())).thenReturn(localRecipients);
        when(fanoutHydrator.hydrate(metadata, localRecipients))
            .thenReturn(List.of(new ChatFanoutDelivery(1L, response)));
        org.mockito.Mockito.doThrow(new IllegalStateException("broker unavailable"))
            .doNothing()
            .when(messagingTemplate)
            .convertAndSendToUser("1", "/queue/chat.events", response);

        listener.onMessage(redisMessage(metadata), null);
        listener.onMessage(redisMessage(metadata), null);

        verify(fanoutHydrator, times(2)).hydrate(metadata, localRecipients);
        verify(messagingTemplate, times(2)).convertAndSendToUser("1", "/queue/chat.events", response);
    }

    private ChatFanoutMetadata messageMetadata() {
        return new ChatFanoutMetadata(EVENT_ID, ChatEventType.MESSAGE_CREATED,
            ChatEventOutbox.EVENT_VERSION, OCCURRED_AT, ROOM_PUBLIC_ID, List.of(1L, 2L),
            MESSAGE_PUBLIC_ID, 1L, 1L, null, null, null, null);
    }

    private Message redisMessage(ChatFanoutMetadata metadata) throws Exception {
        Message message = org.mockito.Mockito.mock(Message.class);
        when(message.getBody()).thenReturn(objectMapper.writeValueAsBytes(metadata));
        return message;
    }
}
