package com.finalcall.gateway.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class HomeRecommendationRateLimitPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
        .withUserConfiguration(TestConfig.class);

    @Test
    void 정상값을_바인딩한다() {
        runner.withPropertyValues(
            "gateway.home-recommend-rate-limit.replenish-rate=2",
            "gateway.home-recommend-rate-limit.burst-capacity=10",
            "gateway.home-recommend-rate-limit.requested-tokens=3")
            .run(context -> {
                assertThat(context).hasNotFailed();
                assertThat(context.getBean(HomeRecommendationRateLimitProperties.class))
                    .extracting(
                        HomeRecommendationRateLimitProperties::replenishRate,
                        HomeRecommendationRateLimitProperties::burstCapacity,
                        HomeRecommendationRateLimitProperties::requestedTokens)
                    .containsExactly(2, 10, 3);
            });
    }

    @Test
    void 최대_정수_requestedTokens도_RetryAfter_계산이_overflow되지_않는다() {
        HomeRecommendationRateLimitProperties properties = new HomeRecommendationRateLimitProperties(1, 10,
            Integer.MAX_VALUE);

        assertThat(properties.retryAfterSeconds()).isEqualTo(2_147_483_647L);
    }

    @Test
    void replenishRate가_0이면_부팅에_실패한다() {
        assertValidationFailure("gateway.home-recommend-rate-limit.replenish-rate=0", "0보다 커야 합니다");
    }

    @Test
    void requestedTokens가_음수이면_부팅에_실패한다() {
        assertValidationFailure("gateway.home-recommend-rate-limit.requested-tokens=-1", "0보다 커야 합니다");
    }

    @Test
    void burstCapacity가_replenishRate보다_작으면_부팅에_실패한다() {
        runner.withPropertyValues(
            "gateway.home-recommend-rate-limit.replenish-rate=11",
            "gateway.home-recommend-rate-limit.burst-capacity=10",
            "gateway.home-recommend-rate-limit.requested-tokens=1")
            .run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).rootCause()
                    .hasMessageContaining("burstCapacity는 replenishRate 이상이어야 합니다");
            });
    }

    private void assertValidationFailure(String property, String message) {
        runner.withPropertyValues(
            "gateway.home-recommend-rate-limit.replenish-rate=1",
            "gateway.home-recommend-rate-limit.burst-capacity=10",
            "gateway.home-recommend-rate-limit.requested-tokens=1",
            property)
            .run(context -> {
                assertThat(context).hasFailed();
                assertThat(context.getStartupFailure()).rootCause().hasMessageContaining(message);
            });
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(HomeRecommendationRateLimitProperties.class)
    static class TestConfig {
    }
}
