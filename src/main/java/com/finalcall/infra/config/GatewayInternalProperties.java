package com.finalcall.infra.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.NotBlank;

/**
 * 서비스 측 직접접근 차단 설정(D-068).
 *
 * <p>엣지 게이트웨이가 하류 요청에 부착하는 공유비밀({@code X-Gateway-Token})을 검증한다.
 * 게이트웨이를 거치지 않은 직접 접근(헤더 부재·불일치)은 차단한다. 게이트웨이 모듈과 <b>동일한 비밀</b>을
 * 공유해야 하며, 운영에서는 환경변수({@code GATEWAY_INTERNAL_SECRET})로 주입해 누락 시 부팅을 중단한다(fail-fast).
 *
 * <p>★ 프로퍼티 명칭: 환경변수 {@code GATEWAY_INTERNAL_SECRET} 가 relaxed binding 으로 정확히
 * {@code gateway.internal.secret} 에 매핑되도록 프리픽스를 {@code gateway.internal} 로 둔다(게이트웨이 모듈과 동일).
 *
 * <p>{@code enforced} 는 차단 활성 여부다. 실 프로파일(local/dev/prod)은 켠다. 통합테스트는 게이트웨이를
 * 거치지 않는 MockMvc 직접 호출이므로 {@code false} 로 내려 기존 검증을 방해하지 않는다.
 */
@Validated
@ConfigurationProperties(prefix = "gateway.internal")
public record GatewayInternalProperties(

    /** 공유비밀. 게이트웨이가 부착한 값과 대조된다. */
    @NotBlank String secret,

    /** 검증할 헤더명(기본 X-Gateway-Token). */
    String header,

    /** 직접접근 차단 활성 여부(기본 true). */
    boolean enforced) {

    private static final String DEFAULT_HEADER = "X-Gateway-Token";

    public GatewayInternalProperties {
        if (header == null || header.isBlank()) {
            header = DEFAULT_HEADER;
        }
    }
}
