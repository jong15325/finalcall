package com.finalcall.domain.chat.realtime;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.finalcall.common.exception.CommonErrorCode;

/** 인증 interceptor 뒤에서 STOMP frame과 destination을 최소 allowlist로 인가한다. */
@Component
public class ChatStompAuthorizationInterceptor implements ChannelInterceptor {

    public static final String USER_CHAT_DESTINATION = "/user/queue/chat.events";
    private static final String AUTO_ACK = "auto";

    private final ChatWebSocketSessionRegistry sessionRegistry;

    public ChatStompAuthorizationInterceptor(ChatWebSocketSessionRegistry sessionRegistry) {
        this.sessionRegistry = sessionRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        String sessionId = accessor.getSessionId();
        StompCommand command = accessor.getCommand();
        if (command == StompCommand.DISCONNECT) {
            return message;
        }
        if (!sessionRegistry.isAuthenticated(sessionId)) {
            reject(sessionId);
            return null;
        }
        boolean allowed = switch (command) {
            case CONNECT, UNSUBSCRIBE -> true;
            case SUBSCRIBE -> isAllowedSubscription(accessor);
            default -> false;
        };
        if (!allowed) {
            reject(sessionId);
            return null;
        }
        return message;
    }

    private boolean isAllowedSubscription(StompHeaderAccessor accessor) {
        String ack = accessor.getAck();
        return USER_CHAT_DESTINATION.equals(accessor.getDestination())
            && (ack == null || AUTO_ACK.equals(ack));
    }

    private void reject(String sessionId) {
        if (sessionId != null) {
            sessionRegistry.reject(sessionId, CommonErrorCode.FORBIDDEN);
        }
    }
}
