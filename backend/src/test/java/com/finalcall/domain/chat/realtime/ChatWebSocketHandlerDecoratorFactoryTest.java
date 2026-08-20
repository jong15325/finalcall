package com.finalcall.domain.chat.realtime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;

class ChatWebSocketHandlerDecoratorFactoryTest {

    private final ChatWebSocketSessionRegistry sessionRegistry = mock(ChatWebSocketSessionRegistry.class);
    private final WebSocketHandler delegate = mock(WebSocketHandler.class);
    private final WebSocketHandler handler = new ChatWebSocketHandlerDecoratorFactory(
        sessionRegistry).decorate(delegate);

    @Test
    void 느린_session_종료후에도_다른_session의_heartbeat를_처리한다() throws Exception {
        WebSocketSession slowSession = session("slow-session");
        WebSocketSession healthySession = session("healthy-session");
        TextMessage heartbeat = new TextMessage("\n");

        handler.afterConnectionClosed(slowSession, CloseStatus.SESSION_NOT_RELIABLE);
        handler.handleMessage(healthySession, heartbeat);

        verify(sessionRegistry).closed("slow-session");
        verify(sessionRegistry).touched("healthy-session");
        verify(delegate).afterConnectionClosed(slowSession, CloseStatus.SESSION_NOT_RELIABLE);
        verify(delegate).handleMessage(healthySession, heartbeat);
        verify(healthySession, never()).close(any(CloseStatus.class));
    }

    private WebSocketSession session(String sessionId) {
        WebSocketSession session = mock(WebSocketSession.class);
        org.mockito.Mockito.when(session.getId()).thenReturn(sessionId);
        return session;
    }
}
