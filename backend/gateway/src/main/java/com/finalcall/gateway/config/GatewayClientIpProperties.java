package com.finalcall.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.PositiveOrZero;

/** rate limit client IP를 해석할 때 신뢰하는 gateway 앞단 프록시 hop 수. */
@Validated
@ConfigurationProperties(prefix = "gateway.client-ip")
public record GatewayClientIpProperties(@PositiveOrZero int trustedProxyCount) {
}
