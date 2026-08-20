package com.finalcall.support;

import org.junit.jupiter.api.AfterEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.test.context.TestPropertySource;
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
// D-068: 통합테스트는 게이트웨이를 거치지 않는 MockMvc 직접 호출이라 직접접근 차단을 끈다(공유비밀 헤더 없음).
//   차단 자체의 검증은 별도 GatewayAccessIntegrationTest 가 enforced=true 로 오버라이드해 수행한다.
// EPIC-CLOSING: 마감 워커 배경 tick 을 끈다(closing.worker.enabled=false) — 배경 tick 이 테스트 데이터를
//   비결정적으로 마감하지 못하게 하고, 마감 검증은 CloseWorker.sweepOnce()/CloseService.closeOne() 직접 호출로 한다.
// FC-084: 로컬 데모 시드 러너(LocalDemoSeeder)는 default 프로파일(local) 통합 테스트에서도 뜨므로 끈다 —
//   시드가 테스트 데이터에 개입하면 픽스처·불변식 단언이 비결정적으로 깨진다.
// EPIC-SHOP: 고정가 만료 워커 배경 tick 도 끈다(shop.expiry.worker.enabled=false) — 배경 tick 이 테스트 데이터를
//   비결정적으로 만료하지 못하게 하고, 만료 검증은 ShopExpiryWorker.sweepOnce()/ShopExpiryService.expireOne() 직접 호출로 한다.
// EPIC-ITEM-DELIVERY: 배송 라이프사이클 워커 배경 tick 도 끈다(delivery.worker.enabled=false) — 배경 tick 이 테스트
//   데이터를 비결정적으로 IN_GAME 전이·리스 재청구하지 못하게 하고, reconcile/reclaim 검증은 워커 메서드 직접 호출로 한다.
// EPIC-SEARCH: 검색 화해 워커 배경 tick 을 끄고(search.reconciliation.enabled=false), ES 미기동 통합 테스트에서
//   /actuator/health 가 ES DOWN 으로 503 이 되지 않도록 ES health 컨트리뷰터를 끈다(색인/검색 검증은 ES
//   Testcontainer 를 띄우는 ListingSearchIntegrationTest 가 전담 — 여기 base 는 MySQL/Redis 만 공유한다).
// EPIC-BOARD(FC-200): 게시글 이미지 스토리지(MinIO/S3) 부팅 시 버킷 생성 러너를 끈다 — 스토리지 무관 통합 테스트에서
//   MinIO 미기동에 startup 접속 지연·경고가 나지 않도록. 실 스토리지 검증은 MinIO Testcontainer 를 띄우는
//   BoardImageStorageIntegrationTest 가 전담하고, 바인딩·인가는 StoragePort 를 @MockBean 으로 대체해 검증한다.
@TestPropertySource(properties = {
    "gateway.internal.enforced=false", "closing.worker.enabled=false", "shop.expiry.worker.enabled=false",
    "delivery.worker.enabled=false", "chat.retention.enabled=false", "demo.seed.enabled=false",
    "search.reconciliation.enabled=false",
    "search.reindex-on-startup=false", "management.health.elasticsearch.enabled=false",
    "board.image.storage.ensure-bucket-on-startup=false"})
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
