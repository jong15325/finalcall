package com.finalcall.domain.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** 공용 테스트 계정 진입점 활성화 설정. */
@ConfigurationProperties(prefix = "demo.access")
public record DemoLoginProperties(boolean enabled) {
}
