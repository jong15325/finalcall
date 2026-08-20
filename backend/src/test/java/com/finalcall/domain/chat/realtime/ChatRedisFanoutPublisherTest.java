package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;

@ExtendWith(MockitoExtension.class)
class ChatRedisFanoutPublisherTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @InjectMocks
    private ChatRedisFanoutPublisher publisher;

    @Test
    void 한개이상_node가_수신했을때만_발행성공이다() {
        when(redisTemplate.convertAndSend(ChatRedisFanoutPublisher.FANOUT_CHANNEL, "metadata"))
            .thenReturn(2L, 0L, null);

        assertThat(publisher.publish("metadata")).isTrue();
        assertThat(publisher.publish("metadata")).isFalse();
        assertThat(publisher.publish("metadata")).isFalse();
    }

    @Test
    void Redis_장애는_발행실패로_반환한다() {
        when(redisTemplate.convertAndSend(ChatRedisFanoutPublisher.FANOUT_CHANNEL, "metadata"))
            .thenThrow(new QueryTimeoutException("timeout"));

        assertThat(publisher.publish("metadata")).isFalse();
    }
}
