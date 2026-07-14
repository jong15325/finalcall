package com.finalcall.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;

/**
 * 게이트웨이 ↔ 서비스 공유비밀 설정(D-068).
 *
 * <p>게이트웨이는 하류(서비스) 요청에 이 비밀을 {@code X-Gateway-Token} 헤더로 부착하고,
 * 서비스는 같은 비밀로 직접접근을 차단한다. 운영에서는 기본값 없이 환경변수({@code GATEWAY_INTERNAL_SECRET})로
 * 주입하며, 누락 시 {@link NotBlank} 검증 실패로 부팅이 중단된다(fail-fast).
 *
 * <p>★ 프로퍼티 명칭: 환경변수 {@code GATEWAY_INTERNAL_SECRET} 가 relaxed binding 으로 정확히
 * {@code gateway.internal.secret} 에 매핑되도록 프리픽스를 {@code gateway.internal} 로 둔다
 * (대시는 제거되므로 {@code internal-secret} 는 {@code GATEWAY_INTERNALSECRET} 에 매핑되어 어긋난다 —
 * JWT_SECRET→jwt.secret 과 동일한 기존 규약).
 *
 * <p>★ fail-fast 주의: dev/prod yml 에 {@code ${GATEWAY_INTERNAL_SECRET}} placeholder 를 두면 미해결 시
 * 리터럴로 남아 검증을 통과해 fail-fast 가 무력화된다. 따라서 검증 대상 값은 placeholder 대신
 * relaxed binding(환경변수 직접)으로 주입한다.
 */
@Validated
@ConfigurationProperties(prefix = "gateway.internal")
public record GatewayInternalProperties(

    /** 공유비밀. 서비스 측 동일 값과 대조된다. */
    @NotBlank String secret,

    /** 하류로 부착할 헤더명(기본 X-Gateway-Token). */
    String header) {

    private static final String DEFAULT_HEADER = "X-Gateway-Token";

    public GatewayInternalProperties {
        if (header == null || header.isBlank()) {
            header = DEFAULT_HEADER;
        }
    }
}
