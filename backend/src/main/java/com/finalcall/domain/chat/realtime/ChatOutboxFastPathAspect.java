package com.finalcall.domain.chat.realtime;

import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.finalcall.domain.chat.entity.ChatEventOutbox;

import lombok.extern.slf4j.Slf4j;

/** outbox save 호출의 DB commit 뒤에만 Redis fast-path를 발행한다. */
@Slf4j
@Aspect
@Component
public class ChatOutboxFastPathAspect {

    private final ChatOutboxFastPathDispatcher dispatcher;
    private final ChatOutboxFastPathSnapshotFactory snapshotFactory;

    public ChatOutboxFastPathAspect(ChatOutboxFastPathDispatcher dispatcher,
        ChatOutboxFastPathSnapshotFactory snapshotFactory) {
        this.dispatcher = dispatcher;
        this.snapshotFactory = snapshotFactory;
    }

    @AfterReturning(pointcut = "this(com.finalcall.domain.chat.repository.ChatEventOutboxRepository)"
        + " && execution(* save(..)) && args(event)")
    public void afterOutboxSaved(ChatEventOutbox event) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            log.warn("[ChatRealtime] 트랜잭션 밖 outbox save라 fast-path를 생략합니다. eventId={}", event.getEventId());
            return;
        }
        ChatOutboxFastPathEvent snapshot = snapshotFactory.create(event).orElse(null);
        if (snapshot == null) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                dispatcher.enqueue(snapshot);
            }
        });
    }
}
