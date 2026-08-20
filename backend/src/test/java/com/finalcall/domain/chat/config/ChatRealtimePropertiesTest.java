package com.finalcall.domain.chat.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

class ChatRealtimePropertiesTest {

    @Test
    void exact_origin과_heartbeat보다_긴_lease만_유효하다() {
        ChatRealtimeProperties properties = properties("https://finalcall.example.com",
            Duration.ofSeconds(45));

        assertThat(properties.isValidPolicy()).isTrue();
    }

    @Test
    void wildcard_origin은_유효하지_않다() {
        assertThat(properties("*", Duration.ofSeconds(45)).isValidPolicy()).isFalse();
    }

    private ChatRealtimeProperties properties(String origin, Duration leaseTtl) {
        return new ChatRealtimeProperties(List.of(origin), Duration.ofSeconds(5),
            Duration.ofSeconds(10), Duration.ofSeconds(30), leaseTtl, 3, 20);
    }
}
