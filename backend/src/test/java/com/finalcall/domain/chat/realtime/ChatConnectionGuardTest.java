package com.finalcall.domain.chat.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.finalcall.domain.chat.config.ChatRealtimeProperties;
import com.finalcall.domain.chat.realtime.ChatConnectionGuard.GuardOutcome;

class ChatConnectionGuardTest {

    private final StringRedisTemplate redisTemplate = org.mockito.Mockito.mock(StringRedisTemplate.class);
    private final ChatConnectionGuard guard = new ChatConnectionGuard(redisTemplate, properties());

    @Test
    void Redis_장애면_node_local_quota를_위해_fail_open한다() {
        when(redisTemplate.execute(any(), anyList(), any(), any(), any(), any()))
            .thenThrow(new QueryTimeoutException("redis unavailable"));

        assertThat(guard.claim("42", "session-1")).isEqualTo(GuardOutcome.FAIL_OPEN);
    }

    @Test
    void connect_rate_limit이_거절되면_socket_lease를_claim하지_않는다() {
        when(redisTemplate.execute(any(), anyList(), any(), any(), any(), any())).thenReturn(0L);

        assertThat(guard.claim("42", "session-1")).isEqualTo(GuardOutcome.DENIED);
    }

    private ChatRealtimeProperties properties() {
        return new ChatRealtimeProperties(List.of("http://localhost:5173"), Duration.ofSeconds(5),
            Duration.ofSeconds(10), Duration.ofSeconds(30), Duration.ofSeconds(45), 3, 20);
    }
}
