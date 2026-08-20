package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.config.WebSocketMessageBrokerStats;
import org.springframework.web.socket.messaging.SubProtocolWebSocketHandler;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

class ChatWebSocketSendLimitMetricsTest {

    @Test
    void Spring_send_limit_누적치를_계약_metric으로_노출한다() {
        WebSocketMessageBrokerStats brokerStats = mock(WebSocketMessageBrokerStats.class);
        SubProtocolWebSocketHandler.Stats sessionStats = mock(SubProtocolWebSocketHandler.Stats.class);
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        when(brokerStats.getWebSocketSessionStats()).thenReturn(sessionStats);
        when(sessionStats.getLimitExceededSessions()).thenReturn(3);

        new ChatWebSocketSendLimitMetrics(brokerStats).bindTo(registry);

        assertThat(registry.get("chat.websocket.send.buffer.exceeded").functionCounter().count())
            .isEqualTo(3.0);
    }
}
