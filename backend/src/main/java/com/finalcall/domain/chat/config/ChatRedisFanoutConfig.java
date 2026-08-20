package com.finalcall.domain.chat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

import com.finalcall.domain.chat.listener.ChatRedisFanoutListener;
import com.finalcall.domain.chat.realtime.ChatRedisFanoutPublisher;

/** 모든 app node가 같은 versioned Redis channel을 구독하도록 fan-out listener를 배선한다. */
@Configuration
public class ChatRedisFanoutConfig {

    @Bean
    public RedisMessageListenerContainer chatRedisMessageListenerContainer(
        RedisConnectionFactory connectionFactory,
        ChatRedisFanoutListener listener) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listener, new ChannelTopic(ChatRedisFanoutPublisher.FANOUT_CHANNEL));
        return container;
    }
}
