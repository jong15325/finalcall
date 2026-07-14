package com.finalcall.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * SCG 엣지 게이트웨이 진입점(D-068).
 *
 * <p>단일 서비스(모놀리식) 앞단의 별도 배포 단위. 역할은 엣지 관심사에 한정한다 —
 * 라우팅, rate limit(Redis 토큰버킷), 직접접근 차단(공유비밀 {@code X-Gateway-Token} 부착).
 * 인증(JWT 검증)은 서비스가 전담하므로 게이트웨이는 토큰을 검증하지 않고 {@code X-User-Id} 도 주입하지 않는다.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
