package com.finalcall.support;

import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 통합 테스트 base class(Stage F2).
 *
 * <p>실제 MySQL/Redis(Testcontainers)를 공유하며 Flyway → JPA validate 흐름을 이 컨텍스트 로딩으로 검증한다.
 * MockMvc 는 Security 필터 체인을 거치므로 실제 토큰/@WithMockUser 인증 모두 검증할 수 있다.
 *
 * <p>★ 데이터 격리: JPA(RDB)는 각 테스트에 {@code @Transactional} 롤백을 붙여 정리한다(base 에는 걸지 않는다 —
 * 실제 커밋 검증 테스트를 방해할 수 있으므로). Redis 는 롤백이 안 되므로 아래 {@code @AfterEach} 에서 명시적으로 정리한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    private RedisConnectionFactory redisConnectionFactory;

    @AfterEach
    void flushRedis() {
        // 캐시/락 상태가 다음 테스트로 새지 않도록 Redis 를 비운다(롤백 대상 아님).
        redisConnectionFactory.getConnection().serverCommands().flushDb();
    }
}
