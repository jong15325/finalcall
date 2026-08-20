package com.finalcall.domain.chat.realtime;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.config.WebSocketMessageBrokerStats;
import org.springframework.web.socket.messaging.SubProtocolWebSocketHandler;

import io.micrometer.core.instrument.FunctionCounter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.binder.MeterBinder;

/** Spring WebSocket의 단조 send-limit 누적치를 Prometheus 계약 metric으로 노출한다. */
@Component
public class ChatWebSocketSendLimitMetrics implements MeterBinder {

    private final WebSocketMessageBrokerStats brokerStats;

    public ChatWebSocketSendLimitMetrics(WebSocketMessageBrokerStats brokerStats) {
        this.brokerStats = brokerStats;
    }

    @Override
    public void bindTo(MeterRegistry registry) {
        FunctionCounter.builder("chat.websocket.send.buffer.exceeded", brokerStats,
            this::limitExceededSessions)
            .description("느린 WebSocket client의 send time 또는 buffer 한도 초과 횟수")
            .register(registry);
    }

    private double limitExceededSessions(WebSocketMessageBrokerStats stats) {
        SubProtocolWebSocketHandler.Stats sessionStats = stats.getWebSocketSessionStats();
        return sessionStats == null ? 0.0 : sessionStats.getLimitExceededSessions();
    }
}
