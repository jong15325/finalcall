package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.chat.config.ChatFastPathProperties;
import com.finalcall.domain.chat.entity.ChatEventOutbox;
import com.finalcall.domain.chat.entity.ChatEventType;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatOutboxFastPathDispatcherTest {

    @Test
    void 느린_Redis_worker와_무관하게_enqueue는_즉시_반환한다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            entered.countDown();
            while (release.getCount() > 0L) {
                try {
                    release.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {
                    // Redis driver가 interrupt에 협조하지 않는 최악 조건을 재현한다.
                }
            }
            return true;
        }).when(publisher).publish(any());
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofMillis(100));

        long started = System.nanoTime();
        fixture.dispatcher.enqueue(event("01H00000000000000000000000"));
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);

        assertThat(entered.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(elapsedMillis).isLessThan(100L);
        release.countDown();
        fixture.dispatcher.shutdown();
    }

    @Test
    void queue_포화는_호출을_실패시키지_않고_rejected_metric을_증가시킨다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            entered.countDown();
            while (release.getCount() > 0L) {
                try {
                    release.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {
                    // Redis driver가 interrupt에 협조하지 않는 최악 조건을 재현한다.
                }
            }
            return true;
        }).when(publisher).publish(any());
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofMillis(100));

        fixture.dispatcher.enqueue(event("01H00000000000000000000000"));
        assertThat(entered.await(1, TimeUnit.SECONDS)).isTrue();
        fixture.dispatcher.enqueue(event("01H00000000000000000000001"));
        fixture.dispatcher.enqueue(event("01H00000000000000000000002"));

        assertThat(fixture.registry.get("chat.fast_path.enqueue.total")
            .tag("result", "rejected").counter().count()).isEqualTo(1.0);
        release.countDown();
        fixture.dispatcher.shutdown();
    }

    @Test
    void worker_실패는_context를_유출하지_않고_failed_metric만_증가시킨다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        CountDownLatch completed = new CountDownLatch(1);
        doAnswer(invocation -> {
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(MDC.get("requestId")).isNull();
            completed.countDown();
            throw new IllegalStateException("redis failure");
        }).when(publisher).publish(any());
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofMillis(100));
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken("user", "secret"));
        MDC.put("requestId", "sensitive-request");

        fixture.dispatcher.enqueue(event("01H00000000000000000000000"));

        assertThat(completed.await(1, TimeUnit.SECONDS)).isTrue();
        fixture.dispatcher.shutdown();
        assertThat(fixture.registry.get("chat.fast_path.publish.total")
            .tag("result", "failed").counter().count()).isEqualTo(1.0);
        SecurityContextHolder.clearContext();
        MDC.clear();
    }

    @Test
    void 종료_timeout은_대기_queue를_유한하게_drop한다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            entered.countDown();
            while (release.getCount() > 0L) {
                try {
                    release.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {
                    // Redis driver가 interrupt에 협조하지 않는 최악 조건을 재현한다.
                }
            }
            return true;
        }).when(publisher).publish(any());
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofMillis(20));
        fixture.dispatcher.enqueue(event("01H00000000000000000000000"));
        assertThat(entered.await(1, TimeUnit.SECONDS)).isTrue();
        fixture.dispatcher.enqueue(event("01H00000000000000000000001"));

        long shutdownStarted = System.nanoTime();
        fixture.dispatcher.shutdown();
        long shutdownMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - shutdownStarted);

        assertThat(shutdownMillis).isLessThan(500L);
        assertThat(fixture.registry.get("chat.fast_path.shutdown.dropped").counter().count()).isEqualTo(2.0);
        release.countDown();
        Thread.sleep(50L);
        assertThat(fixture.registry.find("chat.fast_path.publish.total").counters())
            .allMatch(counter -> counter.count() == 0.0);
        fixture.dispatcher.enqueue(event("01H00000000000000000000002"));
        assertThat(fixture.registry.get("chat.fast_path.enqueue.total")
            .tag("result", "shutdown").counter().count()).isEqualTo(1.0);
    }

    @Test
    void 정상_worker는_snapshot을_한_번만_publish한다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        when(publisher.publish(any())).thenReturn(true);
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofSeconds(1));
        ChatOutboxFastPathEvent snapshot = event("01H00000000000000000000000");

        fixture.dispatcher.enqueue(snapshot);
        fixture.dispatcher.shutdown();

        verify(publisher).publish(snapshot);
        verify(publisher, never()).publish(event("01H00000000000000000000001"));
        assertThat(fixture.registry.get("chat.fast_path.publish.total")
            .tag("result", "success").counter().count()).isEqualTo(1.0);
    }

    @Test
    void publisher_인자에는_allowlist_metadata만_존재한다() throws Exception {
        ChatOutboxFastPathPublisher publisher = mock(ChatOutboxFastPathPublisher.class);
        when(publisher.publish(any())).thenReturn(true);
        Fixture fixture = fixture(publisher, 1, 1, Duration.ofSeconds(1));
        ChatEventOutbox outbox = ChatEventOutbox.builder()
            .eventId("01H00000000000000000000000")
            .aggregateId("01H00000000000000000000009")
            .eventType(ChatEventType.MESSAGE_CREATED)
            .payload("{\"recipientIds\":[1],\"messagePublicId\":\"01H00000000000000000000008\","
                + "\"body\":\"secret-body\",\"authorization\":\"Bearer secret-jwt\","
                + "\"reportDetail\":\"secret-report\"}")
            .occurredAt(Instant.parse("2026-08-20T00:00:00Z"))
            .build();
        ChatOutboxFastPathEvent snapshot = new ChatOutboxFastPathSnapshotFactory(new ObjectMapper())
            .create(outbox).orElseThrow();

        fixture.dispatcher.enqueue(snapshot);
        fixture.dispatcher.shutdown();

        org.mockito.ArgumentCaptor<ChatOutboxFastPathEvent> captured = org.mockito.ArgumentCaptor
            .forClass(ChatOutboxFastPathEvent.class);
        verify(publisher).publish(captured.capture());
        assertThat(captured.getValue().metadataJson())
            .contains("messagePublicId", "recipientIds")
            .doesNotContain("body", "secret-body", "authorization", "secret-jwt", "reportDetail", "secret-report");
    }

    private Fixture fixture(ChatOutboxFastPathPublisher publisher, int workers, int queueCapacity,
        Duration shutdownTimeout) {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        ChatFastPathMetrics metrics = new ChatFastPathMetrics(registry);
        ChatFastPathProperties properties = new ChatFastPathProperties(workers, queueCapacity, shutdownTimeout);
        return new Fixture(new ChatOutboxFastPathDispatcher(publisher, metrics, properties), registry);
    }

    private ChatOutboxFastPathEvent event(String eventId) {
        return new ChatOutboxFastPathEvent(eventId, "{\"eventId\":\"" + eventId + "\"}");
    }

    private record Fixture(ChatOutboxFastPathDispatcher dispatcher, SimpleMeterRegistry registry) {
    }
}
