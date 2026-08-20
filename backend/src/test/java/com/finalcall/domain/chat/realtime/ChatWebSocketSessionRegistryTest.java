package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.chat.config.ChatRealtimeProperties;
import com.finalcall.domain.chat.realtime.ChatConnectionGuard.GuardOutcome;

class ChatWebSocketSessionRegistryTest {

    private final ChatConnectionGuard connectionGuard = mock(ChatConnectionGuard.class);
    private final TaskScheduler taskScheduler = mock(TaskScheduler.class);
    private final ChatWebSocketSessionRegistry registry = new ChatWebSocketSessionRegistry(
        connectionGuard, properties(), taskScheduler, new ObjectMapper());

    @Test
    void Redis_fail_open에서도_node_local_세개만_허용하고_JWT_exp_종료를_예약한다() {
        doReturn(scheduledFuture()).when(taskScheduler)
            .schedule(any(Runnable.class), any(Instant.class));
        when(connectionGuard.claim(any(), any())).thenReturn(GuardOutcome.FAIL_OPEN);
        Instant expiresAt = Instant.now().plusSeconds(300L);
        for (int index = 1; index <= 4; index++) {
            registry.opened(session("session-" + index));
        }

        assertThat(registry.authenticate("session-1", "42", expiresAt)).isTrue();
        assertThat(registry.authenticate("session-2", "42", expiresAt)).isTrue();
        assertThat(registry.authenticate("session-3", "42", expiresAt)).isTrue();
        assertThat(registry.authenticate("session-4", "42", expiresAt)).isFalse();

        assertThat(registry.localRecipients(List.of(42L, 99L))).containsExactly(42L);
        verify(connectionGuard, times(3)).claim(any(), any());
        ArgumentCaptor<Instant> schedules = ArgumentCaptor.forClass(Instant.class);
        verify(taskScheduler, times(7)).schedule(any(Runnable.class), schedules.capture());
        assertThat(schedules.getAllValues()).contains(expiresAt);
    }

    @Test
    void 한_session의_Redis_claim이_지연돼도_다른_session_인증을_막지_않는다() throws Exception {
        doReturn(scheduledFuture()).when(taskScheduler)
            .schedule(any(Runnable.class), any(Instant.class));
        CountDownLatch firstClaimEntered = new CountDownLatch(1);
        CountDownLatch releaseFirstClaim = new CountDownLatch(1);
        when(connectionGuard.claim(any(), any())).thenAnswer(invocation -> {
            if ("session-1".equals(invocation.getArgument(1))) {
                firstClaimEntered.countDown();
                releaseFirstClaim.await(5L, TimeUnit.SECONDS);
            }
            return GuardOutcome.ALLOWED;
        });
        registry.opened(session("session-1"));
        registry.opened(session("session-2"));
        Instant expiresAt = Instant.now().plusSeconds(300L);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<Boolean> first = executor.submit(
                () -> registry.authenticate("session-1", "42", expiresAt));
            assertThat(firstClaimEntered.await(1L, TimeUnit.SECONDS)).isTrue();

            Future<Boolean> second = executor.submit(
                () -> registry.authenticate("session-2", "42", expiresAt));

            assertThat(second.get(1L, TimeUnit.SECONDS)).isTrue();
            releaseFirstClaim.countDown();
            assertThat(first.get(1L, TimeUnit.SECONDS)).isTrue();
        } finally {
            releaseFirstClaim.countDown();
        }
    }

    @Test
    void 한_session의_Redis_lease_refresh가_지연돼도_다른_session_heartbeat를_막지_않는다() throws Exception {
        ChatRealtimeProperties fastRefreshProperties = new ChatRealtimeProperties(
            List.of("http://localhost:5173"), Duration.ofSeconds(5), Duration.ofNanos(1),
            Duration.ofSeconds(30), Duration.ofSeconds(45), 3, 20);
        ChatWebSocketSessionRegistry fastRefreshRegistry = new ChatWebSocketSessionRegistry(
            connectionGuard, fastRefreshProperties, taskScheduler, new ObjectMapper());
        doReturn(scheduledFuture()).when(taskScheduler)
            .schedule(any(Runnable.class), any(Instant.class));
        when(connectionGuard.claim(any(), any())).thenReturn(GuardOutcome.ALLOWED);
        fastRefreshRegistry.opened(session("session-1"));
        fastRefreshRegistry.opened(session("session-2"));
        Instant expiresAt = Instant.now().plusSeconds(300L);
        assertThat(fastRefreshRegistry.authenticate("session-1", "42", expiresAt)).isTrue();
        assertThat(fastRefreshRegistry.authenticate("session-2", "42", expiresAt)).isTrue();
        CountDownLatch firstRefreshEntered = new CountDownLatch(1);
        CountDownLatch releaseFirstRefresh = new CountDownLatch(1);
        org.mockito.Mockito.doAnswer(invocation -> {
            if ("session-1".equals(invocation.getArgument(1))) {
                firstRefreshEntered.countDown();
                releaseFirstRefresh.await(5L, TimeUnit.SECONDS);
            }
            return null;
        }).when(connectionGuard).refresh(any(), any());

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<?> first = executor.submit(() -> fastRefreshRegistry.touched("session-1"));
            assertThat(firstRefreshEntered.await(1L, TimeUnit.SECONDS)).isTrue();
            Future<?> second = executor.submit(() -> fastRefreshRegistry.touched("session-2"));

            second.get(1L, TimeUnit.SECONDS);
            releaseFirstRefresh.countDown();
            first.get(1L, TimeUnit.SECONDS);
        } finally {
            releaseFirstRefresh.countDown();
        }
        verify(connectionGuard).refresh("42", "session-1");
        verify(connectionGuard).refresh("42", "session-2");
    }

    @Test
    void 같은_session의_동시_CONNECT는_한번만_claim한다() throws Exception {
        doReturn(scheduledFuture()).when(taskScheduler)
            .schedule(any(Runnable.class), any(Instant.class));
        CountDownLatch claimEntered = new CountDownLatch(1);
        CountDownLatch releaseClaim = new CountDownLatch(1);
        when(connectionGuard.claim("42", "session-1")).thenAnswer(invocation -> {
            claimEntered.countDown();
            releaseClaim.await(5L, TimeUnit.SECONDS);
            return GuardOutcome.ALLOWED;
        });
        registry.opened(session("session-1"));
        Instant expiresAt = Instant.now().plusSeconds(300L);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<Boolean> first = executor.submit(
                () -> registry.authenticate("session-1", "42", expiresAt));
            assertThat(claimEntered.await(1L, TimeUnit.SECONDS)).isTrue();

            assertThat(registry.authenticate("session-1", "42", expiresAt)).isFalse();
            releaseClaim.countDown();
            assertThat(first.get(1L, TimeUnit.SECONDS)).isTrue();
        } finally {
            releaseClaim.countDown();
        }
        verify(connectionGuard).claim("42", "session-1");
    }

    @Test
    void JWT_exp_task는_1008로_종료하고_local과_Redis_lease를_정리한다() throws Exception {
        doReturn(scheduledFuture()).when(taskScheduler)
            .schedule(any(Runnable.class), any(Instant.class));
        when(connectionGuard.claim("42", "session-1")).thenReturn(GuardOutcome.ALLOWED);
        WebSocketSession session = session("session-1");
        registry.opened(session);
        assertThat(registry.authenticate("session-1", "42", Instant.now().plusSeconds(300L))).isTrue();
        ArgumentCaptor<Runnable> scheduledTasks = ArgumentCaptor.forClass(Runnable.class);
        verify(taskScheduler, times(2)).schedule(scheduledTasks.capture(), any(Instant.class));

        scheduledTasks.getAllValues().getLast().run();

        verify(session).close(CloseStatus.POLICY_VIOLATION);
        verify(connectionGuard).release("42", "session-1");
        assertThat(registry.localRecipients(List.of(42L))).isEmpty();
    }

    private WebSocketSession session(String sessionId) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        when(session.isOpen()).thenReturn(true);
        return session;
    }

    private ChatRealtimeProperties properties() {
        return new ChatRealtimeProperties(List.of("http://localhost:5173"), Duration.ofSeconds(5),
            Duration.ofSeconds(10), Duration.ofSeconds(30), Duration.ofSeconds(45), 3, 20);
    }

    @SuppressWarnings("unchecked")
    private ScheduledFuture<?> scheduledFuture() {
        return mock(ScheduledFuture.class);
    }
}
