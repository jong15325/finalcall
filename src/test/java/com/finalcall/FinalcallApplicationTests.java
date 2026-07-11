package com.finalcall;

import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;

/**
 * 컨텍스트 로딩 검증(Stage F2에서 Testcontainers 기반으로 전환).
 *
 * <p>실제 MySQL(Testcontainers)에서 Flyway 마이그레이션 적용 → JPA validate 통과 → 전체 빈 구성 로딩을 검증한다.
 */
class FinalcallApplicationTests extends IntegrationTest {

    @Test
    void contextLoads() {
    }
}
