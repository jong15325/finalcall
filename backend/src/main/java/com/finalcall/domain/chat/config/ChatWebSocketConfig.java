package com.finalcall.domain.chat.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

import com.finalcall.domain.chat.realtime.ChatHandshakeInterceptor;
import com.finalcall.domain.chat.realtime.ChatStompAuthenticationInterceptor;
import com.finalcall.domain.chat.realtime.ChatStompAuthorizationInterceptor;
import com.finalcall.domain.chat.realtime.ChatWebSocketHandlerDecoratorFactory;

import jakarta.websocket.server.ServerContainer;

/** native WebSocket + STOMP 1.2 server→client push 전용 설정. */
@Configuration
@EnableWebSocketMessageBroker
public class ChatWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String ENDPOINT = "/ws/chat";
    private static final int APPLICATION_MESSAGE_LIMIT_BYTES = 8 * 1024;
    private static final int TRANSPORT_BUFFER_LIMIT_BYTES = 16 * 1024;
    private static final int SEND_BUFFER_LIMIT_BYTES = 512 * 1024;
    private static final int SEND_TIME_LIMIT_MILLIS = 10_000;

    private final ChatRealtimeProperties properties;
    private final ChatHandshakeInterceptor handshakeInterceptor;
    private final ChatStompAuthenticationInterceptor authenticationInterceptor;
    private final ChatStompAuthorizationInterceptor authorizationInterceptor;
    private final ChatWebSocketHandlerDecoratorFactory handlerDecoratorFactory;
    private final ThreadPoolTaskScheduler heartbeatTaskScheduler;

    public ChatWebSocketConfig(ChatRealtimeProperties properties,
        ChatHandshakeInterceptor handshakeInterceptor,
        ChatStompAuthenticationInterceptor authenticationInterceptor,
        ChatStompAuthorizationInterceptor authorizationInterceptor,
        ChatWebSocketHandlerDecoratorFactory handlerDecoratorFactory,
        @Qualifier("chatHeartbeatTaskScheduler") ThreadPoolTaskScheduler heartbeatTaskScheduler) {
        this.properties = properties;
        this.handshakeInterceptor = handshakeInterceptor;
        this.authenticationInterceptor = authenticationInterceptor;
        this.authorizationInterceptor = authorizationInterceptor;
        this.handlerDecoratorFactory = handlerDecoratorFactory;
        this.heartbeatTaskScheduler = heartbeatTaskScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint(ENDPOINT)
            .addInterceptors(handshakeInterceptor)
            .setAllowedOrigins(properties.allowedOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        long heartbeatMillis = properties.heartbeatInterval().toMillis();
        registry.enableSimpleBroker("/queue")
            .setTaskScheduler(heartbeatTaskScheduler)
            .setHeartbeatValue(new long[] {heartbeatMillis, heartbeatMillis});
        registry.setUserDestinationPrefix("/user/");
        registry.setPreservePublishOrder(true);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authenticationInterceptor, authorizationInterceptor);
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.setMessageSizeLimit(APPLICATION_MESSAGE_LIMIT_BYTES)
            .setSendBufferSizeLimit(SEND_BUFFER_LIMIT_BYTES)
            .setSendTimeLimit(SEND_TIME_LIMIT_MILLIS)
            .addDecoratorFactory(handlerDecoratorFactory);
    }

    @Bean
    public ServletContextInitializer chatWebSocketBufferInitializer() {
        return servletContext -> {
            Object attribute = servletContext.getAttribute(ServerContainer.class.getName());
            if (attribute instanceof ServerContainer container) {
                container.setDefaultMaxTextMessageBufferSize(TRANSPORT_BUFFER_LIMIT_BYTES);
                container.setDefaultMaxBinaryMessageBufferSize(TRANSPORT_BUFFER_LIMIT_BYTES);
            }
        };
    }

    @Bean(name = "chatHeartbeatTaskScheduler")
    public static ThreadPoolTaskScheduler chatHeartbeatTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("chat-heartbeat-");
        scheduler.setRemoveOnCancelPolicy(true);
        return scheduler;
    }
}
