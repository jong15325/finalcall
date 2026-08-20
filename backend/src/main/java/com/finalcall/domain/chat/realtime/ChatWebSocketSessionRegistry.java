package com.finalcall.domain.chat.realtime;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.common.response.ErrorResponse;
import com.finalcall.domain.chat.config.ChatRealtimeProperties;
import com.finalcall.domain.chat.realtime.ChatConnectionGuard.GuardOutcome;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/** node-local WebSocket 세션 정본. CONNECT deadline, JWT exp, inactivity와 local quota를 관리한다. */
@Slf4j
@Component
public class ChatWebSocketSessionRegistry {

    private final ConcurrentMap<String, SessionState> sessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Set<String>> sessionsByUser = new ConcurrentHashMap<>();
    private final ChatConnectionGuard connectionGuard;
    private final ChatRealtimeProperties properties;
    private final TaskScheduler taskScheduler;
    private final ObjectMapper objectMapper;

    private ScheduledFuture<?> inactivitySweep;

    public ChatWebSocketSessionRegistry(ChatConnectionGuard connectionGuard,
        ChatRealtimeProperties properties,
        @Qualifier("chatHeartbeatTaskScheduler") TaskScheduler chatHeartbeatTaskScheduler,
        ObjectMapper objectMapper) {
        this.connectionGuard = connectionGuard;
        this.properties = properties;
        this.taskScheduler = chatHeartbeatTaskScheduler;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void startInactivitySweep() {
        inactivitySweep = taskScheduler.scheduleWithFixedDelay(this::closeInactiveSessions,
            properties.heartbeatInterval());
    }

    @PreDestroy
    void stopInactivitySweep() {
        if (inactivitySweep != null) {
            inactivitySweep.cancel(false);
        }
    }

    /** HTTP upgrade가 성립한 세션을 등록하고 5초 CONNECT deadline을 건다. */
    public void opened(WebSocketSession session) {
        Instant now = Instant.now();
        SessionState state = new SessionState(session, now);
        SessionState previous = sessions.putIfAbsent(session.getId(), state);
        if (previous != null) {
            close(session, CloseStatus.POLICY_VIOLATION);
            return;
        }
        ScheduledFuture<?> deadlineTask = taskScheduler.schedule(
            () -> closeIfUnauthenticated(session.getId()), now.plus(properties.connectTimeout()));
        synchronized (state) {
            if (state.lifecycle == SessionLifecycle.CLOSED) {
                cancel(deadlineTask);
            } else {
                state.connectDeadlineTask = deadlineTask;
            }
        }
    }

    /** 검증된 JWT 주체를 세션에 귀속한다. Redis 장애 시에도 node-local 최대 3개를 강제한다. */
    public boolean authenticate(String sessionId, String userId, Instant expiresAt) {
        SessionState state = sessions.get(sessionId);
        Instant now = Instant.now();
        if (state == null || expiresAt == null || !expiresAt.isAfter(now)) {
            return false;
        }
        synchronized (state) {
            if (state.lifecycle != SessionLifecycle.OPENED || sessions.get(sessionId) != state) {
                return false;
            }
            state.lifecycle = SessionLifecycle.AUTHENTICATING;
            state.userId = userId;
        }
        if (!reserveLocalSession(userId, sessionId)) {
            return false;
        }
        synchronized (state) {
            if (state.lifecycle == SessionLifecycle.CLOSED) {
                removeLocalSession(userId, sessionId);
                return false;
            }
            state.localSessionReserved = true;
        }

        GuardOutcome guardOutcome;
        try {
            guardOutcome = connectionGuard.claim(userId, sessionId);
        } catch (RuntimeException ex) {
            removeLocalReservation(state, userId, sessionId);
            throw ex;
        }
        if (guardOutcome == GuardOutcome.DENIED) {
            removeLocalReservation(state, userId, sessionId);
            return false;
        }
        boolean connectionClosed;
        synchronized (state) {
            connectionClosed = state.lifecycle == SessionLifecycle.CLOSED || sessions.get(sessionId) != state;
            if (!connectionClosed) {
                state.lifecycle = SessionLifecycle.AUTHENTICATED;
                state.lastInboundAt = now;
                state.lastLeaseRefreshAt = now;
                cancel(state.connectDeadlineTask);
            }
        }
        if (connectionClosed) {
            removeLocalSession(userId, sessionId);
            connectionGuard.release(userId, sessionId);
            return false;
        }
        ScheduledFuture<?> expiryTask = taskScheduler.schedule(() -> closeExpired(sessionId), expiresAt);
        synchronized (state) {
            if (state.lifecycle == SessionLifecycle.CLOSED) {
                cancel(expiryTask);
            } else {
                state.expiryTask = expiryTask;
            }
        }
        return true;
    }

    /** heartbeat를 포함한 모든 inbound transport activity로 inactivity와 lease를 갱신한다. */
    public void touched(String sessionId) {
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            return;
        }
        Instant now = Instant.now();
        String userId = null;
        synchronized (state) {
            if (state.lifecycle == SessionLifecycle.CLOSED) {
                return;
            }
            state.lastInboundAt = now;
            if (state.lifecycle == SessionLifecycle.AUTHENTICATED
                && Duration.between(state.lastLeaseRefreshAt, now)
                    .compareTo(properties.heartbeatInterval()) >= 0) {
                userId = state.userId;
                state.lastLeaseRefreshAt = now;
            }
        }
        if (userId != null) {
            connectionGuard.refresh(userId, sessionId);
        }
    }

    public boolean isAuthenticated(String sessionId) {
        SessionState state = sessions.get(sessionId);
        return state != null && state.lifecycle == SessionLifecycle.AUTHENTICATED;
    }

    /** recipient 중 이 node에 활성 세션이 있는 사용자만 반환한다. DB hydration 전 호출한다. */
    public Set<Long> localRecipients(Collection<Long> recipientIds) {
        Set<Long> localRecipients = new HashSet<>();
        for (Long recipientId : recipientIds) {
            Set<String> userSessions = sessionsByUser.get(String.valueOf(recipientId));
            if (userSessions != null && userSessions.stream().anyMatch(this::isAuthenticated)) {
                localRecipients.add(recipientId);
            }
        }
        return Set.copyOf(localRecipients);
    }

    /** 정책 위반 ERROR를 best-effort 전송한 뒤 close code 1008로 종료한다. */
    public void reject(String sessionId, ErrorCode errorCode) {
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            return;
        }
        WebSocketSession session = state.session;
        try {
            if (session.isOpen()) {
                byte[] body = objectMapper.writeValueAsBytes(ErrorResponse.of(errorCode));
                String frame = "ERROR\nmessage:" + errorCode.getMessage()
                    + "\ncontent-type:application/json"
                    + "\ncontent-length:" + body.length + "\n\n"
                    + new String(body, StandardCharsets.UTF_8) + '\0';
                synchronized (session) {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(frame));
                    }
                }
            }
        } catch (IOException ex) {
            log.debug("[ChatRealtime] STOMP ERROR 전송 실패. sessionId={}", sessionId, ex);
        } finally {
            closeAndCleanup(sessionId, state);
        }
    }

    /** transport close callback에서 local/Redis lease를 함께 정리한다. */
    public void closed(String sessionId) {
        SessionState state = sessions.remove(sessionId);
        if (state == null) {
            return;
        }
        String userId;
        boolean localSessionReserved;
        synchronized (state) {
            state.lifecycle = SessionLifecycle.CLOSED;
            cancel(state.connectDeadlineTask);
            cancel(state.expiryTask);
            userId = state.userId;
            localSessionReserved = state.localSessionReserved;
            state.localSessionReserved = false;
        }
        if (userId != null && localSessionReserved) {
            removeLocalSession(userId, sessionId);
            connectionGuard.release(userId, sessionId);
        }
    }

    private void closeIfUnauthenticated(String sessionId) {
        if (!isAuthenticated(sessionId)) {
            SessionState state = sessions.get(sessionId);
            if (state != null) {
                closeAndCleanup(sessionId, state);
            }
        }
    }

    private void closeExpired(String sessionId) {
        SessionState state = sessions.get(sessionId);
        if (state != null) {
            closeAndCleanup(sessionId, state);
        }
    }

    private void closeInactiveSessions() {
        Instant threshold = Instant.now().minus(properties.inactivityTimeout());
        sessions.forEach((sessionId, state) -> {
            if (state.lifecycle == SessionLifecycle.AUTHENTICATED && state.lastInboundAt.isBefore(threshold)) {
                closeAndCleanup(sessionId, state);
            }
        });
    }

    private boolean reserveLocalSession(String userId, String sessionId) {
        AtomicBoolean reserved = new AtomicBoolean();
        sessionsByUser.compute(userId, (ignored, currentSessions) -> {
            Set<String> userSessions = currentSessions;
            if (userSessions == null) {
                userSessions = ConcurrentHashMap.newKeySet();
            }
            if (userSessions.size() < properties.maxSocketsPerUser()) {
                reserved.set(userSessions.add(sessionId));
            }
            return userSessions;
        });
        return reserved.get();
    }

    private void removeLocalReservation(SessionState state, String userId, String sessionId) {
        synchronized (state) {
            state.localSessionReserved = false;
        }
        removeLocalSession(userId, sessionId);
    }

    private void removeLocalSession(String userId, String sessionId) {
        sessionsByUser.computeIfPresent(userId, (ignored, userSessions) -> {
            userSessions.remove(sessionId);
            return userSessions.isEmpty() ? null : userSessions;
        });
    }

    private void closeAndCleanup(String sessionId, SessionState state) {
        close(state.session, CloseStatus.POLICY_VIOLATION);
        closed(sessionId);
    }

    private void close(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (IOException ex) {
            log.debug("[ChatRealtime] WebSocket 종료 실패. sessionId={}", session.getId(), ex);
        }
    }

    private void cancel(ScheduledFuture<?> task) {
        if (task != null) {
            task.cancel(false);
        }
    }

    private static final class SessionState {

        private final WebSocketSession session;
        private volatile Instant lastInboundAt;
        private volatile Instant lastLeaseRefreshAt;
        private volatile String userId;
        private volatile ScheduledFuture<?> connectDeadlineTask;
        private volatile ScheduledFuture<?> expiryTask;
        private volatile SessionLifecycle lifecycle = SessionLifecycle.OPENED;
        private boolean localSessionReserved;

        private SessionState(WebSocketSession session, Instant openedAt) {
            this.session = session;
            this.lastInboundAt = openedAt;
            this.lastLeaseRefreshAt = openedAt;
        }
    }

    private enum SessionLifecycle {
        OPENED,
        AUTHENTICATING,
        AUTHENTICATED,
        CLOSED
    }
}
