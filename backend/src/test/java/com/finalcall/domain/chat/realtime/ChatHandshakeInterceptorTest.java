package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import com.finalcall.domain.chat.config.ChatRealtimeProperties;

class ChatHandshakeInterceptorTest {

    private final ChatHandshakeInterceptor interceptor = new ChatHandshakeInterceptor(
        new ChatRealtimeProperties(List.of("http://localhost:5173"), Duration.ofSeconds(5),
            Duration.ofSeconds(10), Duration.ofSeconds(30), Duration.ofSeconds(45), 3, 20));

    @Test
    void query_token이_붙은_handshake를_거절한다() {
        assertThat(beforeHandshake("ws://localhost/ws/chat?access_token=secret")).isFalse();
    }

    @Test
    void query가_없는_handshake만_허용한다() {
        assertThat(beforeHandshake("ws://localhost/ws/chat", "http://localhost:5173")).isTrue();
    }

    @Test
    void origin이_없거나_allowlist와_다르면_거절한다() {
        assertThat(beforeHandshake("ws://localhost/ws/chat", null)).isFalse();
        assertThat(beforeHandshake("ws://localhost/ws/chat", "https://evil.example")).isFalse();
    }

    private boolean beforeHandshake(String uri) {
        return beforeHandshake(uri, "http://localhost:5173");
    }

    private boolean beforeHandshake(String uri, String origin) {
        ServerHttpRequest request = mock(ServerHttpRequest.class);
        HttpHeaders headers = new HttpHeaders();
        if (origin != null) {
            headers.setOrigin(origin);
        }
        when(request.getURI()).thenReturn(URI.create(uri));
        when(request.getHeaders()).thenReturn(headers);
        return interceptor.beforeHandshake(request, mock(ServerHttpResponse.class),
            mock(WebSocketHandler.class), new HashMap<>());
    }
}
