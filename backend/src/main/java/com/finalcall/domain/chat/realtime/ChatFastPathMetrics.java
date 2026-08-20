package com.finalcall.domain.chat.realtime;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/** fast-path enqueue, publish, 종료 상태를 고정 tag로 관측한다. */
@Component
public class ChatFastPathMetrics {

    private final MeterRegistry registry;
    private final Counter accepted;
    private final Counter rejected;
    private final Counter shutdown;
    private final Counter publishSucceeded;
    private final Counter publishFailed;
    private final Counter shutdownDropped;

    public ChatFastPathMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.accepted = counter(registry, "chat.fast_path.enqueue", "accepted");
        this.rejected = counter(registry, "chat.fast_path.enqueue", "rejected");
        this.shutdown = counter(registry, "chat.fast_path.enqueue", "shutdown");
        this.publishSucceeded = counter(registry, "chat.fast_path.publish", "success");
        this.publishFailed = counter(registry, "chat.fast_path.publish", "failed");
        this.shutdownDropped = Counter.builder("chat.fast_path.shutdown.dropped").register(registry);
    }

    public void bindExecutor(ThreadPoolExecutor executor) {
        Gauge.builder("chat.fast_path.queue.depth", executor, value -> value.getQueue().size())
            .register(registry);
        Gauge.builder("chat.fast_path.active.workers", executor, ThreadPoolExecutor::getActiveCount)
            .register(registry);
    }

    void accepted() {
        accepted.increment();
    }

    void rejected() {
        rejected.increment();
    }

    void shutdown() {
        shutdown.increment();
    }

    void published(boolean succeeded) {
        (succeeded ? publishSucceeded : publishFailed).increment();
    }

    void shutdownDropped(int count) {
        shutdownDropped.increment(count);
    }

    private Counter counter(MeterRegistry registry, String name, String result) {
        return Counter.builder(name + ".total").tag("result", result).register(registry);
    }
}
