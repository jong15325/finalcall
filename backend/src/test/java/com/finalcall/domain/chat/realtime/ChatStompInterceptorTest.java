package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.security.TokenClaims;
import com.finalcall.common.security.TokenProvider;

@ExtendWith(MockitoExtension.class)
class ChatStompInterceptorTest {

    @Mock
    private TokenProvider tokenProvider;

    @Mock
    private ChatWebSocketSessionRegistry sessionRegistry;

    @Mock
    private MessageChannel channel;

    @InjectMocks
    private ChatStompAuthenticationInterceptor authenticationInterceptor;

    @Test
    void connect_bearer를_검증해_userId_principal을_설정한다() {
        Message<byte[]> message = stompMessage(StompCommand.CONNECT, accessor -> {
            accessor.setNativeHeader("accept-version", "1.2");
            accessor.setNativeHeader("heart-beat", "10000,10000");
            accessor.setNativeHeader("Authorization", "Bearer access-token");
        });
        Instant expiresAt = Instant.now().plusSeconds(300L);
        when(tokenProvider.parseAccessToken("access-token"))
            .thenReturn(new TokenClaims("42", "01H00000000000000000000000", false, expiresAt));
        when(sessionRegistry.authenticate("session-1", "42", expiresAt)).thenReturn(true);

        Message<?> result = authenticationInterceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertThat(resultAccessor.getUser()).isNotNull();
        assertThat(resultAccessor.getUser().getName()).isEqualTo("42");
    }

    @Test
    void query가_아닌_connect_header라도_필수_STOMP_협상이_없으면_거절한다() {
        Message<byte[]> message = stompMessage(StompCommand.CONNECT,
            accessor -> accessor.setNativeHeader("Authorization", "Bearer access-token"));

        assertThat(authenticationInterceptor.preSend(message, channel)).isNull();
        verify(sessionRegistry).reject("session-1", CommonErrorCode.INVALID_INPUT);
    }

    @Test
    void subscribe는_고정_user_destination과_auto_ack만_허용한다() {
        ChatStompAuthorizationInterceptor interceptor = new ChatStompAuthorizationInterceptor(sessionRegistry);
        Message<byte[]> allowed = stompMessage(StompCommand.SUBSCRIBE, accessor -> {
            accessor.setDestination(ChatStompAuthorizationInterceptor.USER_CHAT_DESTINATION);
            accessor.setAck("auto");
        });
        when(sessionRegistry.isAuthenticated("session-1")).thenReturn(true);

        assertThat(interceptor.preSend(allowed, channel)).isSameAs(allowed);

        Message<byte[]> forged = stompMessage(StompCommand.SUBSCRIBE,
            accessor -> accessor.setDestination("/user/99/queue/chat.events"));
        assertThat(interceptor.preSend(forged, channel)).isNull();
        verify(sessionRegistry).reject("session-1", CommonErrorCode.FORBIDDEN);
    }

    @Test
    void send_frame은_인증후에도_거절한다() {
        ChatStompAuthorizationInterceptor interceptor = new ChatStompAuthorizationInterceptor(sessionRegistry);
        Message<byte[]> send = stompMessage(StompCommand.SEND,
            accessor -> accessor.setDestination("/app/chat"));
        when(sessionRegistry.isAuthenticated("session-1")).thenReturn(true);

        assertThat(interceptor.preSend(send, channel)).isNull();
        verify(sessionRegistry).reject("session-1", CommonErrorCode.FORBIDDEN);
    }

    @Test
    void 인증실패로_socket이_닫힐때_생성되는_disconnect는_재거절하지_않는다() {
        ChatStompAuthorizationInterceptor interceptor = new ChatStompAuthorizationInterceptor(sessionRegistry);
        Message<byte[]> disconnect = stompMessage(StompCommand.DISCONNECT,
            accessor -> assertThat(accessor).isNotNull());

        assertThat(interceptor.preSend(disconnect, channel)).isSameAs(disconnect);
    }

    private Message<byte[]> stompMessage(StompCommand command,
        java.util.function.Consumer<StompHeaderAccessor> customizer) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setSessionId("session-1");
        customizer.accept(accessor);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
