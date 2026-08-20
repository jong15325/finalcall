package com.finalcall.domain.chat.realtime;

import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.finalcall.domain.chat.config.ChatRealtimeProperties;

/** JWT의 URL/proxy log 유출을 막기 위해 query가 붙은 handshake를 거절한다. */
@Component
public class ChatHandshakeInterceptor implements HandshakeInterceptor {

    private final ChatRealtimeProperties properties;

    public ChatHandshakeInterceptor(ChatRealtimeProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
        WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String origin = request.getHeaders().getOrigin();
        return request.getURI().getRawQuery() == null
            && origin != null
            && properties.allowedOrigins().contains(origin);
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
        WebSocketHandler wsHandler, Exception exception) {
        // 정리할 handshake 상태 없음.
    }
}
