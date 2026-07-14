package com.finalcall.gateway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 게이트웨이 컨텍스트 로드 검증(D-068).
 *
 * <p>라우트 정의·RequestRateLimiter·KeyResolver·공유비밀 프로퍼티 바인딩이 부팅 시점에 성립하는지 확인한다.
 * Redis 는 Lettuce 가 지연 연결하므로 실제 Redis 없이도 컨텍스트는 로드된다(local 기본값 사용).
 */
@SpringBootTest
class GatewayApplicationTests {

    @Test
    @DisplayName("게이트웨이 애플리케이션 컨텍스트가 정상 로드된다")
    void contextLoads() {
        // 컨텍스트 로딩 자체가 검증(라우트/필터/프로퍼티 바인딩 실패 시 이 테스트가 깨진다).
    }
}
