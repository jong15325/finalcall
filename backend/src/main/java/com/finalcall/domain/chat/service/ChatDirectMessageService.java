package com.finalcall.domain.chat.service;

import java.util.concurrent.ThreadLocalRandom;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.stereotype.Service;

import com.finalcall.common.logging.ServiceLog;

import lombok.RequiredArgsConstructor;

/** direct room 첫 메시지 명령의 전체 트랜잭션 재시도 경계. */
@Service
@RequiredArgsConstructor
public class ChatDirectMessageService {

    private static final int MAX_ATTEMPTS = 3;
    private static final int BASE_BACKOFF_MILLIS = 10;

    private final ChatCommandService commandService;

    @ServiceLog
    public ChatDirectMessagePersistence send(String counterpartNickname, String clientMessageId,
        String body) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return commandService.sendDirectMessage(counterpartNickname, clientMessageId, body);
            } catch (PessimisticLockingFailureException | DataIntegrityViolationException ex) {
                if (attempt == MAX_ATTEMPTS) {
                    throw ex;
                }
                backoff(attempt);
            }
        }
        throw new IllegalStateException("채팅 첫 메시지 재시도 흐름이 비정상 종료되었습니다.");
    }

    private void backoff(int attempt) {
        long upperBound = (long)BASE_BACKOFF_MILLIS << (attempt - 1);
        try {
            Thread.sleep(ThreadLocalRandom.current().nextLong(upperBound + 1L));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("채팅 첫 메시지 재시도가 중단되었습니다.", ex);
        }
    }
}
