package com.finalcall.domain.chat.listener;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

/** Redis fast-path와 Kafka fallback이 중복 전달한 event를 node-local 범위에서 제한한다. */
@Component
public class ChatFanoutEventDeduplicator {

    private static final int MAX_ENTRIES = 200_000;
    private static final Duration RETENTION = Duration.ofMinutes(10);

    private final Map<String, Claim> claimedEvents = new LinkedHashMap<>();
    private final Clock clock;

    public ChatFanoutEventDeduplicator() {
        this(Clock.systemUTC());
    }

    ChatFanoutEventDeduplicator(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean claim(String eventId) {
        Instant now = clock.instant();
        evictExpired(now);
        if (claimedEvents.containsKey(eventId)) {
            return false;
        }
        claimedEvents.put(eventId, new Claim(now, false));
        evictOverflow();
        return true;
    }

    public synchronized void complete(String eventId) {
        Claim claim = claimedEvents.get(eventId);
        if (claim != null && !claim.completed()) {
            claimedEvents.put(eventId, new Claim(clock.instant(), true));
        }
    }

    public synchronized void release(String eventId) {
        Claim claim = claimedEvents.get(eventId);
        if (claim != null && !claim.completed()) {
            claimedEvents.remove(eventId);
        }
    }

    private void evictExpired(Instant now) {
        Iterator<Map.Entry<String, Claim>> iterator = claimedEvents.entrySet().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().getValue().claimedAt().plus(RETENTION).isAfter(now)) {
                return;
            }
            iterator.remove();
        }
    }

    private void evictOverflow() {
        Iterator<String> iterator = claimedEvents.keySet().iterator();
        while (claimedEvents.size() > MAX_ENTRIES && iterator.hasNext()) {
            iterator.next();
            iterator.remove();
        }
    }

    private record Claim(Instant claimedAt, boolean completed) {
    }
}
