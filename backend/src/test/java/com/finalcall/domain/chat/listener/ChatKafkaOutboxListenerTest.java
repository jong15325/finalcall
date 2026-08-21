package com.finalcall.domain.chat.listener;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.support.Acknowledgment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.finalcall.domain.chat.config.ChatKafkaProperties;
import com.finalcall.domain.chat.realtime.ChatRedisFanoutPublisher;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatKafkaOutboxListenerTest {

    private static final String EVENT_ID = "01H00000000000000000000000";
    private static final String ROOM_PUBLIC_ID = "01H00000000000000000000001";
    private static final String MESSAGE_PUBLIC_ID = "01H00000000000000000000002";
    private static final Duration RETRY_BACKOFF = Duration.ofSeconds(1);

    private final ChatRedisFanoutPublisher fanoutPublisher = org.mockito.Mockito.mock(
        ChatRedisFanoutPublisher.class);
    private final Acknowledgment acknowledgment = org.mockito.Mockito.mock(Acknowledgment.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    private ChatKafkaOutboxListener listener;

    @BeforeEach
    void setUp() {
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        ChatKafkaProperties properties = new ChatKafkaProperties(
            new ChatKafkaProperties.Topic("finalcall.chat.events.v1", 12, (short)3, (short)2,
                Duration.ofDays(7)),
            new ChatKafkaProperties.Consumer(true, true, "finalcall-chat-fanout-v1", RETRY_BACKOFF,
                Duration.ofSeconds(10), Duration.ofSeconds(5)));
        listener = new ChatKafkaOutboxListener(objectMapper, fanoutPublisher, properties, meterRegistry);
    }

    @Test
    void metadata만_Redis로_재발행하고_성공_뒤_offset을_ack한다() {
        when(fanoutPublisher.publish(anyString())).thenReturn(true);

        listener.consume(record(messageEnvelope(null)), acknowledgment);

        ArgumentCaptor<String> published = ArgumentCaptor.forClass(String.class);
        verify(fanoutPublisher).publish(published.capture());
        verify(acknowledgment).acknowledge();
        assertThat(published.getValue())
            .contains(EVENT_ID, ROOM_PUBLIC_ID, MESSAGE_PUBLIC_ID, "\"eventVersion\":1")
            .doesNotContain("body", "token", "Authorization");
    }

    @Test
    void Redis_실패는_ack하지_않고_nack하여_같은_record를_재처리한다() {
        when(fanoutPublisher.publish(anyString())).thenReturn(false, true);
        ConsumerRecord<String, String> record = record(messageEnvelope(null));

        listener.consume(record, acknowledgment);
        verify(acknowledgment, never()).acknowledge();
        verify(acknowledgment).nack(RETRY_BACKOFF);

        Acknowledgment replayAcknowledgment = org.mockito.Mockito.mock(Acknowledgment.class);
        listener.consume(record, replayAcknowledgment);

        verify(fanoutPublisher, times(2)).publish(anyString());
        verify(replayAcknowledgment).acknowledge();
        assertThat(meterRegistry.get("chat.kafka.republish.failures").counter().count()).isEqualTo(1.0);
    }

    @Test
    void fast_path와_CDC의_같은_event_중복은_at_least_once로_허용한다() {
        when(fanoutPublisher.publish(anyString())).thenReturn(true);
        ConsumerRecord<String, String> record = record(messageEnvelope(null));
        Acknowledgment secondAcknowledgment = org.mockito.Mockito.mock(Acknowledgment.class);

        listener.consume(record, acknowledgment);
        listener.consume(record, secondAcknowledgment);

        verify(fanoutPublisher, times(2)).publish(anyString());
        verify(acknowledgment).acknowledge();
        verify(secondAcknowledgment).acknowledge();
    }

    @Test
    void delete_tombstone은_business_event로_발행하지_않고_no_op_ack한다() {
        listener.consume(new ConsumerRecord<>("finalcall.chat.events.v1", 0, 1L, ROOM_PUBLIC_ID, null),
            acknowledgment);

        verify(fanoutPublisher, never()).publish(anyString());
        verify(acknowledgment).acknowledge();
    }

    @Test
    void 본문이나_token이_섞인_envelope는_Redis로_전파하지_않는다() {
        listener.consume(record(messageEnvelope("\"body\":\"유출 금지\",\"accessToken\":\"secret\",")),
            acknowledgment);

        verify(fanoutPublisher, never()).publish(anyString());
        verify(acknowledgment).acknowledge();
    }

    @Test
    void Kafka_key와_roomPublicId가_다르면_전파하지_않는다() {
        ConsumerRecord<String, String> record = new ConsumerRecord<>(
            "finalcall.chat.events.v1", 0, 1L, "01H00000000000000000000009", messageEnvelope(null));

        listener.consume(record, acknowledgment);

        verify(fanoutPublisher, never()).publish(anyString());
        verify(acknowledgment).acknowledge();
    }

    private ConsumerRecord<String, String> record(String value) {
        return new ConsumerRecord<>("finalcall.chat.events.v1", 0, 1L, ROOM_PUBLIC_ID, value);
    }

    private String messageEnvelope(String extraPayload) {
        String extra = extraPayload == null ? "" : extraPayload;
        return """
            {
              "eventId": "%s",
              "eventType": "MESSAGE_CREATED",
              "eventVersion": 1,
              "occurredAt": "2026-08-18T00:00:00Z",
              "roomPublicId": "%s",
              "payload": {
                %s
                "eventId": "%s",
                "roomPublicId": "%s",
                "recipientIds": [1, 2],
                "messagePublicId": "%s",
                "roomSequence": 42,
                "senderId": 1
              }
            }
            """.formatted(EVENT_ID, ROOM_PUBLIC_ID, extra, EVENT_ID, ROOM_PUBLIC_ID, MESSAGE_PUBLIC_ID);
    }
}
