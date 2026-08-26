package com.finalcall.domain.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auth.service.OAuthMetrics.Phase;
import com.finalcall.domain.auth.service.OAuthMetrics.Result;
import com.finalcall.domain.member.entity.SocialProvider;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/** OAuth metric이 허용된 저카디널리티 태그만 생성하는지 검증한다. */
class OAuthMetricsTest {

    @Test
    void 요청과_provider_호출은_허용된_태그만_기록한다() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        OAuthMetrics metrics = new OAuthMetrics(registry);

        metrics.recordRequest(SocialProvider.KAKAO, Result.SUCCESS, 200, metrics.start());
        metrics.recordProviderCall(SocialProvider.KAKAO, Phase.TOKEN, Result.SUCCESS, metrics.start());

        assertThat(registry.get("oauth.backend.requests").counter().count()).isEqualTo(1.0);
        assertThat(registry.get("oauth.provider.duration").timer().count()).isEqualTo(1L);
        assertThat(registry.getMeters())
            .flatExtracting(meter -> meter.getId().getTags())
            .allSatisfy(tag -> assertThat(tag.getKey()).isIn("provider", "result", "phase"));
    }

    @Test
    void 미지원_provider_문자열은_고정값으로_축약한다() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        OAuthMetrics metrics = new OAuthMetrics(registry);

        metrics.recordUnsupportedRequest(metrics.start());

        Meter meter = registry.get("oauth.backend.requests").meter();
        assertThat(meter.getId().getTag("provider")).isEqualTo("unsupported");
        assertThat(meter.getId().getTag("result")).isEqualTo("client_invalid");
    }
}
