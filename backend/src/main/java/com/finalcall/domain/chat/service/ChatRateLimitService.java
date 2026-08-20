package com.finalcall.domain.chat.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ChatErrorCode;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.chat.repository.ChatReportDailyQuotaRepository;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** Redis token bucket 기반 채팅 사용자 제한. Redis 장애는 계약대로 fail-open한다. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRateLimitService {

    private static final String KEY_PREFIX = "finalcall:chat:rate:";
    private static final long MILLIS_PER_SECOND = 1_000L;
    private static final long MILLIS_PER_MINUTE = 60_000L;
    private static final long MILLIS_PER_HOUR = 3_600_000L;
    private static final long MILLIS_PER_DAY = 86_400_000L;
    private static final int DAILY_REPORT_LIMIT = 10;

    private static final RedisScript<Long> TOKEN_BUCKET_SCRIPT = new DefaultRedisScript<>("""
        local current = redis.call('TIME')
        local now = current[1] * 1000 + math.floor(current[2] / 1000)
        local retry = 0
        local states = {}
        for index = 1, #KEYS do
            local offset = (index - 1) * 3
            local capacity = tonumber(ARGV[offset + 1])
            local refill = tonumber(ARGV[offset + 2])
            local period = tonumber(ARGV[offset + 3])
            local stored = redis.call('HMGET', KEYS[index], 'tokens', 'updatedAt')
            local tokens = tonumber(stored[1]) or capacity
            local updatedAt = tonumber(stored[2]) or now
            tokens = math.min(capacity, tokens + math.max(0, now - updatedAt) * refill / period)
            local wait = 0
            if tokens < 1 then
                wait = math.ceil((1 - tokens) * period / refill)
            end
            states[index] = {tokens, capacity, refill, period}
            retry = math.max(retry, wait)
        end
        if retry > 0 then
            return retry
        end
        for index = 1, #KEYS do
            local state = states[index]
            redis.call('HSET', KEYS[index], 'tokens', state[1] - 1, 'updatedAt', now)
            redis.call('PEXPIRE', KEYS[index], math.ceil(state[2] * state[4] / state[3] + state[4]))
        end
        return 0
        """, Long.class);

    private final StringRedisTemplate redisTemplate;
    private final ChatReportDailyQuotaRepository reportDailyQuotaRepository;

    /** 사용자당 5회/초 burst 10과 60회/분을 동시에 적용한다. */
    @ServiceLog
    public void checkMessageSend() {
        consume("message", List.of(
            new ChatRateLimit(10L, 5L, MILLIS_PER_SECOND, "burst"),
            new ChatRateLimit(60L, 60L, MILLIS_PER_MINUTE, "minute")));
    }

    /** 사용자당 direct room 생성 20회/시간을 적용한다. */
    @ServiceLog
    public void checkRoomCreation() {
        consume("room", List.of(new ChatRateLimit(20L, 20L, MILLIS_PER_HOUR, "hour")));
    }

    /** 사용자당 신고 10회/일 Redis 빠른 차단을 적용한다. 장애 시 DB quota가 최종 방어하므로 fail-open한다. */
    @ServiceLog
    public void checkReport() {
        consume("report", List.of(new ChatRateLimit(10L, 10L, MILLIS_PER_DAY, "day")));
    }

    /** report 저장 TX 안에서 UTC 일자 quota를 원자 소비한다. 실패하면 quota 증가도 함께 롤백된다. */
    @Transactional
    @ServiceLog
    public void claimReportQuota(Long reporterId, Instant now) {
        LocalDate quotaDate = LocalDate.ofInstant(now, ZoneOffset.UTC);
        reportDailyQuotaRepository.increment(reporterId, quotaDate, now);
        int reportCount = reportDailyQuotaRepository.findReportCount(reporterId, quotaDate);
        if (reportCount <= DAILY_REPORT_LIMIT) {
            return;
        }

        Instant nextDay = quotaDate.plusDays(1L).atStartOfDay(ZoneOffset.UTC).toInstant();
        setRetryAfter(nextDay.toEpochMilli() - now.toEpochMilli());
        throw new BusinessException(ChatErrorCode.CHAT_RATE_LIMITED);
    }

    private void consume(String operation, List<ChatRateLimit> limits) {
        consume(operation, limits, currentUserId());
    }

    private void consume(String operation, List<ChatRateLimit> limits, Long userId) {
        List<String> keys = new ArrayList<>(limits.size());
        List<String> arguments = new ArrayList<>(limits.size() * 3);
        for (ChatRateLimit limit : limits) {
            keys.add(KEY_PREFIX + "{" + userId + "}:" + operation + ":" + limit.suffix());
            arguments.add(String.valueOf(limit.capacity()));
            arguments.add(String.valueOf(limit.refillTokens()));
            arguments.add(String.valueOf(limit.periodMillis()));
        }
        try {
            Long retryMillis = redisTemplate.execute(TOKEN_BUCKET_SCRIPT, keys, arguments.toArray());
            if (retryMillis != null && retryMillis > 0L) {
                setRetryAfter(retryMillis);
                throw new BusinessException(ChatErrorCode.CHAT_RATE_LIMITED);
            }
        } catch (BusinessException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            log.warn("채팅 사용자 rate limiter Redis 장애를 fail-open 처리했다.", ex);
        }
    }

    private void setRetryAfter(long retryMillis) {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletResponse response = attributes.getResponse();
            if (response != null) {
                long retrySeconds = Math.max(1L, (retryMillis + MILLIS_PER_SECOND - 1L) / MILLIS_PER_SECOND);
                response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retrySeconds));
            }
        }
    }

    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        }
        try {
            return Long.parseLong(authentication.getName());
        } catch (NumberFormatException ex) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        }
    }
}
