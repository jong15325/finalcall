package com.finalcall.domain.auth.service;

import java.time.Duration;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.finalcall.domain.member.entity.SocialProvider;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

/** OAuth 요청과 provider 호출을 제한된 태그 집합으로 계측한다. */
@Component
public class OAuthMetrics {

    private static final Logger log = LoggerFactory.getLogger(OAuthMetrics.class);
    private static final String UNSUPPORTED_PROVIDER = "unsupported";

    private final MeterRegistry registry;

    public OAuthMetrics(MeterRegistry registry) {
        this.registry = registry;
    }

    public long start() {
        return System.nanoTime();
    }

    public void recordRequest(SocialProvider provider, Result result, int status, long startedAt) {
        recordRequest(providerTag(provider), result, status, startedAt);
    }

    public void recordUnsupportedRequest(long startedAt) {
        recordRequest(UNSUPPORTED_PROVIDER, Result.CLIENT_INVALID, 400, startedAt);
    }

    public void recordProviderCall(SocialProvider provider, Phase phase, Result result, long startedAt) {
        Timer.builder("oauth.provider.duration")
            .tag("provider", providerTag(provider))
            .tag("phase", phase.tagValue)
            .tag("result", result.tagValue)
            .register(registry)
            .record(Duration.ofNanos(System.nanoTime() - startedAt));
    }

    private void recordRequest(String provider, Result result, int status, long startedAt) {
        long durationNanos = System.nanoTime() - startedAt;
        Counter.builder("oauth.backend.requests")
            .tag("provider", provider)
            .tag("result", result.tagValue)
            .register(registry)
            .increment();
        log.info("OAuth request completed provider={} result={} status={} durationMs={}",
            provider, result.tagValue, status, Duration.ofNanos(durationNanos).toMillis());
    }

    private String providerTag(SocialProvider provider) {
        return provider.name().toLowerCase(Locale.ROOT);
    }

    public enum Phase {
        TOKEN("token"),
        USERINFO("userinfo");

        private final String tagValue;

        Phase(String tagValue) {
            this.tagValue = tagValue;
        }
    }

    public enum Result {
        SUCCESS("success"),
        CLIENT_INVALID("client_invalid"),
        EXCHANGE_FAILED("exchange_failed"),
        PROVIDER_ERROR("provider_error");

        private final String tagValue;

        Result(String tagValue) {
            this.tagValue = tagValue;
        }
    }
}
