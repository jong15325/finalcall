package com.finalcall.infra.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/**
 * 설정 바인딩 표준(Stage 2) 검증.
 *
 * <p>{@code @ConfigurationProperties} 바인딩과 {@code @Validated} 검증이 실제 동작하는지 확인한다.
 * 전체 앱을 띄우지 않고 ApplicationContextRunner 로 격리 검증한다.
 */
class AppPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withUserConfiguration(TestConfig.class);

    @EnableConfigurationProperties(AppProperties.class)
    static class TestConfig {
    }

    @Test
    void 유효한_값이면_바인딩된다() {
        runner.withPropertyValues("app.name=finalcall", "app.description=경매 플랫폼")
            .run(ctx -> {
                assertThat(ctx).hasNotFailed();
                AppProperties props = ctx.getBean(AppProperties.class);
                assertThat(props.name()).isEqualTo("finalcall");
                assertThat(props.description()).isEqualTo("경매 플랫폼");
            });
    }

    @Test
    void 필수값이_비면_검증실패로_컨텍스트가_뜨지_않는다() {
        runner.withPropertyValues("app.name=", "app.description=경매 플랫폼")
            .run(ctx -> assertThat(ctx).hasFailed());
    }
}
