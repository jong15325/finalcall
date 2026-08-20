package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.time.Instant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;

class ChatOutboxFastPathAspectTest {

    private final ChatOutboxFastPathDispatcher dispatcher = org.mockito.Mockito
        .mock(ChatOutboxFastPathDispatcher.class);
    private final ChatOutboxFastPathSnapshotFactory snapshotFactory = new ChatOutboxFastPathSnapshotFactory(
        new com.fasterxml.jackson.databind.ObjectMapper());
    private final ChatOutboxFastPathAspect aspect = new ChatOutboxFastPathAspect(dispatcher, snapshotFactory);

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void outbox는_DB_commit_뒤에만_fast_path로_발행한다() {
        ChatEventOutbox event = event();
        TransactionSynchronizationManager.initSynchronization();

        aspect.afterOutboxSaved(event);

        verify(dispatcher, never()).enqueue(org.mockito.ArgumentMatchers.any());
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        ArgumentCaptor<ChatOutboxFastPathEvent> snapshot = ArgumentCaptor.forClass(ChatOutboxFastPathEvent.class);
        verify(dispatcher).enqueue(snapshot.capture());
        assertThat(snapshot.getValue().eventId()).isEqualTo(event.getEventId());
    }

    @Test
    void 트랜잭션_밖_save는_선발행하지_않고_CDC복구에_맡긴다() {
        ChatEventOutbox event = event();

        aspect.afterOutboxSaved(event);

        verify(dispatcher, never()).enqueue(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rollback이면_fast_path_enqueue를_시도하지_않는다() {
        TransactionSynchronizationManager.initSynchronization();
        aspect.afterOutboxSaved(event());

        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        }

        verify(dispatcher, never()).enqueue(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void fast_path는_허용_metadata만_발행하고_본문을_복사하지_않는다() {
        ChatRedisFanoutPublisher fanoutPublisher = org.mockito.Mockito.mock(ChatRedisFanoutPublisher.class);
        ChatOutboxFastPathPublisher fastPathPublisher = new ChatOutboxFastPathPublisher(fanoutPublisher);
        ChatEventOutbox event = ChatEventOutbox.builder()
            .eventId("01H00000000000000000000000")
            .aggregateId("01H00000000000000000000001")
            .eventType(ChatEventType.MESSAGE_CREATED)
            .payload("{\"recipientIds\":[1,2],\"messagePublicId\":\"01H00000000000000000000002\","
                + "\"body\":\"유출되면 안 되는 본문\"}")
            .occurredAt(Instant.parse("2026-08-18T00:00:00Z"))
            .build();

        ChatOutboxFastPathEvent snapshot = snapshotFactory.create(event).orElseThrow();
        fastPathPublisher.publish(snapshot);

        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);
        verify(fanoutPublisher).publish(metadata.capture());
        assertThat(snapshot.toString())
            .doesNotContain("body", "authorization", "jwt", "reportDetail");
        assertThat(metadata.getValue())
            .contains("\"eventVersion\":1", "\"eventType\":\"MESSAGE_CREATED\"")
            .doesNotContain("body", "유출되면 안 되는 본문");
    }

    private ChatEventOutbox event() {
        return ChatEventOutbox.builder()
            .eventId("01H00000000000000000000000")
            .aggregateId("01H00000000000000000000001")
            .eventType(ChatEventType.BLOCK_CHANGED)
            .payload("{}")
            .occurredAt(Instant.parse("2026-08-18T00:00:00Z"))
            .build();
    }
}
