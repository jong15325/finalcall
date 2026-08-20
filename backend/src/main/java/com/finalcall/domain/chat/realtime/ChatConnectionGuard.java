package com.finalcall.domain.chat.realtime;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

import com.finalcall.domain.chat.config.ChatRealtimeProperties;

import lombok.extern.slf4j.Slf4j;

/** Redis 원자 연산으로 STOMP CONNECT 빈도와 사용자별 활성 socket lease를 제한한다. */
@Slf4j
@Component
public class ChatConnectionGuard {

    private static final String CONNECT_KEY_PREFIX = "chat:connect:rate:";
    private static final String SOCKET_KEY_PREFIX = "chat:socket:leases:";
    private static final long ONE_MINUTE_MILLIS = 60_000L;

    private static final RedisScript<Long> CONNECT_RATE_SCRIPT = new DefaultRedisScript<>("""
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1] - ARGV[2])
        if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
        redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return 1
        """, Long.class);

    private static final RedisScript<Long> CLAIM_SOCKET_SCRIPT = new DefaultRedisScript<>("""
        redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
        if redis.call('ZSCORE', KEYS[1], ARGV[4]) then
          redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
          redis.call('PEXPIRE', KEYS[1], ARGV[3])
          return 1
        end
        if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[5]) then return 0 end
        redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
        redis.call('PEXPIRE', KEYS[1], ARGV[3])
        return 1
        """, Long.class);

    private static final RedisScript<Long> REFRESH_SOCKET_SCRIPT = new DefaultRedisScript<>("""
        if not redis.call('ZSCORE', KEYS[1], ARGV[3]) then return 0 end
        redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return 1
        """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final ChatRealtimeProperties properties;
    private final String nodeId = UUID.randomUUID().toString();

    public ChatConnectionGuard(StringRedisTemplate redisTemplate, ChatRealtimeProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    /** 연결 빈도와 전 노드 socket quota를 순서대로 원자 확인한다. Redis 장애는 local fallback을 위해 fail-open한다. */
    public GuardOutcome claim(String userId, String sessionId) {
        try {
            long now = Instant.now().toEpochMilli();
            String leaseMember = leaseMember(sessionId);
            Long rateAllowed = redisTemplate.execute(CONNECT_RATE_SCRIPT,
                List.of(connectKey(userId)), String.valueOf(now), String.valueOf(ONE_MINUTE_MILLIS),
                String.valueOf(properties.connectRatePerMinute()), leaseMember + ":" + now);
            if (!Long.valueOf(1L).equals(rateAllowed)) {
                return GuardOutcome.DENIED;
            }
            long leaseMillis = properties.socketLeaseTtl().toMillis();
            Long socketAllowed = redisTemplate.execute(CLAIM_SOCKET_SCRIPT,
                List.of(socketKey(userId)), String.valueOf(now), String.valueOf(now + leaseMillis),
                String.valueOf(leaseMillis), leaseMember, String.valueOf(properties.maxSocketsPerUser()));
            return Long.valueOf(1L).equals(socketAllowed) ? GuardOutcome.ALLOWED : GuardOutcome.DENIED;
        } catch (DataAccessException ex) {
            log.warn("[ChatRealtime] Redis 연결 가드 장애로 node-local quota만 적용합니다.", ex);
            return GuardOutcome.FAIL_OPEN;
        }
    }

    /** heartbeat/inbound frame에서 lease TTL을 갱신한다. Redis 장애는 기존 연결을 끊지 않는다. */
    public void refresh(String userId, String sessionId) {
        try {
            long now = Instant.now().toEpochMilli();
            long leaseMillis = properties.socketLeaseTtl().toMillis();
            redisTemplate.execute(REFRESH_SOCKET_SCRIPT,
                List.of(socketKey(userId)), String.valueOf(now + leaseMillis), String.valueOf(leaseMillis),
                leaseMember(sessionId));
        } catch (DataAccessException ex) {
            log.warn("[ChatRealtime] Redis socket lease 갱신 실패를 무시합니다.", ex);
        }
    }

    /** 연결 종료 시 자기 node의 lease만 제거한다. TTL이 최종 고아 lease 정리를 보장한다. */
    public void release(String userId, String sessionId) {
        try {
            redisTemplate.opsForZSet().remove(socketKey(userId), leaseMember(sessionId));
        } catch (DataAccessException ex) {
            log.warn("[ChatRealtime] Redis socket lease 해제 실패를 무시합니다.", ex);
        }
    }

    private String connectKey(String userId) {
        return CONNECT_KEY_PREFIX + "{" + userId + "}";
    }

    private String socketKey(String userId) {
        return SOCKET_KEY_PREFIX + "{" + userId + "}";
    }

    private String leaseMember(String sessionId) {
        return nodeId + ":" + sessionId;
    }

    public enum GuardOutcome {
        ALLOWED,
        DENIED,
        FAIL_OPEN
    }
}
