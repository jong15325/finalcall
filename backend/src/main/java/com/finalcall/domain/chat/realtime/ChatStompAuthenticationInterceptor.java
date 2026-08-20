package com.finalcall.domain.chat.realtime;

import java.util.Collections;
import java.util.List;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.finalcall.common.exception.ChatErrorCode;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;

import lombok.extern.slf4j.Slf4j;

/** STOMP CONNECT bearer를 공용 TokenProvider로 검증해 userId Principal을 설정한다. */
@Slf4j
@Component
public class ChatStompAuthenticationInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String STOMP_VERSION = "1.2";
    private static final String HEARTBEAT = "10000,10000";

    private final TokenProvider tokenProvider;
    private final ChatWebSocketSessionRegistry sessionRegistry;

    public ChatStompAuthenticationInterceptor(TokenProvider tokenProvider,
        ChatWebSocketSessionRegistry sessionRegistry) {
        this.tokenProvider = tokenProvider;
        this.sessionRegistry = sessionRegistry;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() != StompCommand.CONNECT) {
            return message;
        }
        String sessionId = accessor.getSessionId();
        if (!StringUtils.hasText(sessionId) || sessionRegistry.isAuthenticated(sessionId)) {
            reject(sessionId, CommonErrorCode.UNAUTHORIZED);
            return null;
        }
        if (!STOMP_VERSION.equals(accessor.getFirstNativeHeader("accept-version"))
            || !HEARTBEAT.equals(accessor.getFirstNativeHeader("heart-beat"))) {
            reject(sessionId, CommonErrorCode.INVALID_INPUT);
            return null;
        }
        String token = resolveBearer(accessor);
        if (token == null) {
            reject(sessionId, CommonErrorCode.UNAUTHORIZED);
            return null;
        }
        try {
            TokenClaims claims = tokenProvider.parseAccessToken(token);
            Long.parseLong(claims.userId());
            if (!sessionRegistry.authenticate(sessionId, claims.userId(), claims.expiresAt())) {
                reject(sessionId, ChatErrorCode.CHAT_RATE_LIMITED);
                return null;
            }
            List<GrantedAuthority> authorities = claims.admin()
                ? List.of(new SimpleGrantedAuthority(ROLE_ADMIN))
                : Collections.emptyList();
            accessor.setUser(new UsernamePasswordAuthenticationToken(claims.userId(), null, authorities));
            return message;
        } catch (Exception ex) {
            log.debug("[ChatRealtime] STOMP CONNECT JWT 검증 실패. sessionId={}", sessionId, ex);
            reject(sessionId, CommonErrorCode.UNAUTHORIZED);
            return null;
        }
    }

    private String resolveBearer(StompHeaderAccessor accessor) {
        List<String> values = accessor.getNativeHeader(AUTHORIZATION);
        if (values == null || values.size() != 1) {
            return null;
        }
        String value = values.getFirst();
        if (!StringUtils.hasText(value) || !value.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = value.substring(BEARER_PREFIX.length());
        return StringUtils.hasText(token) ? token : null;
    }

    private void reject(String sessionId, ErrorCode errorCode) {
        if (sessionId != null) {
            sessionRegistry.reject(sessionId, errorCode);
        }
    }
}
