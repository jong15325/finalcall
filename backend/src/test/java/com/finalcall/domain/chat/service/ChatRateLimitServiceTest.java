package com.finalcall.domain.chat.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.domain.chat.repository.ChatReportDailyQuotaRepository;

/** 서비스 Redis limiter의 CHAT_009와 장애 fail-open 정책을 검증한다. */
@ExtendWith(MockitoExtension.class)
class ChatRateLimitServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ChatReportDailyQuotaRepository reportDailyQuotaRepository;

    private ChatRateLimitService rateLimitService;

    @BeforeEach
    void setUp() {
        rateLimitService = new ChatRateLimitService(redisTemplate, reportDailyQuotaRepository);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("42", null, List.of()));
        SecurityContextHolder.setContext(context);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @SuppressWarnings("unchecked")
    void token_bucket이_재시도시간을_반환하면_CHAT_009다() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class)))
            .thenReturn(1_250L);

        assertThatThrownBy(rateLimitService::checkMessageSend)
            .isInstanceOfSatisfying(BusinessException.class,
                ex -> assertThat(ex.getErrorCode().getCode()).isEqualTo("CHAT_009"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void Redis_장애는_채팅_쓰기_가용성을_위해_fail_open한다() {
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(Object[].class)))
            .thenThrow(new IllegalStateException("redis unavailable"));

        assertThatCode(rateLimitService::checkMessageSend).doesNotThrowAnyException();
        assertThatCode(rateLimitService::checkRoomCreation).doesNotThrowAnyException();
        assertThatCode(rateLimitService::checkReport).doesNotThrowAnyException();
    }

}
