package com.finalcall.domain.chat.realtime;

import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;

import com.finalcall.domain.chat.config.ChatFastPathProperties;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/** commit 이후 Redis I/O를 요청 스레드와 분리하는 fast-path 전용 bounded dispatcher. */
@Slf4j
@Component
public class ChatOutboxFastPathDispatcher {

    private final ChatOutboxFastPathPublisher publisher;
    private final ChatFastPathMetrics metrics;
    private final ChatFastPathProperties properties;
    private final ThreadPoolExecutor executor;
    private final Set<DispatchTask> outstanding = ConcurrentHashMap.newKeySet();

    @Autowired
    public ChatOutboxFastPathDispatcher(ChatOutboxFastPathPublisher publisher, ChatFastPathMetrics metrics,
        ChatFastPathProperties properties) {
        this(publisher, metrics, properties, createExecutor(properties));
    }

    ChatOutboxFastPathDispatcher(ChatOutboxFastPathPublisher publisher, ChatFastPathMetrics metrics,
        ChatFastPathProperties properties, ThreadPoolExecutor executor) {
        this.publisher = publisher;
        this.metrics = metrics;
        this.properties = properties;
        this.executor = executor;
        this.metrics.bindExecutor(executor);
        this.executor.prestartAllCoreThreads();
    }

    public void enqueue(ChatOutboxFastPathEvent event) {
        if (executor.isShutdown()) {
            metrics.shutdown();
            return;
        }
        DispatchTask task = new DispatchTask(event);
        outstanding.add(task);
        try {
            executor.execute(task);
            metrics.accepted();
        } catch (RejectedExecutionException ex) {
            outstanding.remove(task);
            if (executor.isShutdown()) {
                metrics.shutdown();
            } else {
                metrics.rejected();
            }
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
        try {
            if (executor.awaitTermination(properties.shutdownTimeout().toMillis(), TimeUnit.MILLISECONDS)) {
                return;
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
        int dropped = 0;
        for (DispatchTask task : outstanding) {
            if (task.drop()) {
                dropped++;
            }
        }
        executor.shutdownNow();
        metrics.shutdownDropped(dropped);
        if (dropped > 0) {
            log.warn("[ChatRealtime] fast-path 종료 제한시간을 초과해 잔여 작업을 폐기합니다. count={}", dropped);
        }
    }

    private static ThreadPoolExecutor createExecutor(ChatFastPathProperties properties) {
        ThreadFactory threadFactory = Thread.ofPlatform()
            .name("chat-fast-path-", 0L)
            .daemon(true)
            .inheritInheritableThreadLocals(false)
            .factory();
        return new ThreadPoolExecutor(
            properties.workers(),
            properties.workers(),
            0L,
            TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(properties.queueCapacity()),
            threadFactory,
            new ThreadPoolExecutor.AbortPolicy());
    }

    private enum TaskState {
        PENDING,
        RUNNING,
        COMPLETED,
        DROPPED
    }

    private final class DispatchTask implements Runnable {

        private final ChatOutboxFastPathEvent event;
        private final AtomicReference<TaskState> state = new AtomicReference<>(TaskState.PENDING);

        private DispatchTask(ChatOutboxFastPathEvent event) {
            this.event = event;
        }

        @Override
        public void run() {
            if (!state.compareAndSet(TaskState.PENDING, TaskState.RUNNING)) {
                outstanding.remove(this);
                return;
            }
            SecurityContextHolder.clearContext();
            RequestContextHolder.resetRequestAttributes();
            MDC.clear();
            boolean succeeded = false;
            try {
                succeeded = publisher.publish(event);
            } catch (RuntimeException ex) {
                log.warn("[ChatRealtime] fast-path worker 발행 실패를 무시합니다. eventId={}", event.eventId(), ex);
            } finally {
                if (state.compareAndSet(TaskState.RUNNING, TaskState.COMPLETED)) {
                    metrics.published(succeeded);
                }
                outstanding.remove(this);
                SecurityContextHolder.clearContext();
                RequestContextHolder.resetRequestAttributes();
                MDC.clear();
            }
        }

        private boolean drop() {
            while (true) {
                TaskState current = state.get();
                if (current == TaskState.COMPLETED || current == TaskState.DROPPED) {
                    return false;
                }
                if (state.compareAndSet(current, TaskState.DROPPED)) {
                    return true;
                }
            }
        }
    }
}
