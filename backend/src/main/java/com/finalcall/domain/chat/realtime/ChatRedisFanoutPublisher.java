package com.finalcall.domain.chat.realtime;

import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/** versioned metadata를 모든 app node가 구독하는 Redis Pub/Sub channel로 best-effort 발행한다. */
@Slf4j
@Component
public class ChatRedisFanoutPublisher {

    public static final String FANOUT_CHANNEL = "finalcall:chat:fanout:v1";

    private final StringRedisTemplate redisTemplate;

    public ChatRedisFanoutPublisher(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /** Redis 장애는 DB 성공을 취소하지 않는다. false면 CDC 재발행과 REST gap replay가 복구한다. */
    public boolean publish(String metadataJson) {
        try {
            Long recipients = redisTemplate.convertAndSend(FANOUT_CHANNEL, metadataJson);
            return recipients != null && recipients > 0L;
        } catch (DataAccessException ex) {
            log.warn("[ChatRealtime] Redis fan-out 발행 실패를 무시합니다. REST replay로 복구합니다.", ex);
            return false;
        }
    }
}
