package com.finalcall.gateway;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.filter.ratelimit.RateLimiter;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;

import com.finalcall.gateway.ratelimit.FailClosedRedisRateLimiter;

/**
 * 게이트웨이 컨텍스트 로드 검증(D-068).
 *
 * <p>라우트 정의·RequestRateLimiter·KeyResolver·공유비밀 프로퍼티 바인딩이 부팅 시점에 성립하는지 확인한다.
 * Redis 는 Lettuce 가 지연 연결하므로 실제 Redis 없이도 컨텍스트는 로드된다(local 기본값 사용).
 */
@SpringBootTest
class GatewayApplicationTests {

    @Autowired
    private RouteDefinitionLocator routeDefinitionLocator;

    @Autowired
    @Qualifier("redisRateLimiter")
    private RedisRateLimiter redisRateLimiter;

    @Autowired
    @Qualifier("homeRecommendationRateLimiter")
    private RateLimiter<RedisRateLimiter.Config> homeRecommendationRateLimiter;

    @Test
    @DisplayName("게이트웨이 애플리케이션 컨텍스트가 정상 로드된다")
    void contextLoads() {
        // 컨텍스트 로딩 자체가 검증(라우트/필터/프로퍼티 바인딩 실패 시 이 테스트가 깨진다).
    }

    @Test
    @DisplayName("홈 전용 fail-closed limiter와 기존 기본 Redis limiter를 분리한다")
    void homeAndDefaultRateLimitersAreSeparated() {
        assertThat(redisRateLimiter).isNotInstanceOf(FailClosedRedisRateLimiter.class);
        assertThat(homeRecommendationRateLimiter)
            .isInstanceOf(FailClosedRedisRateLimiter.class)
            .isNotSameAs(redisRateLimiter);
    }

    @Test
    @DisplayName("채팅 WebSocket route는 ws scheme과 handshake 전용 토큰버킷을 사용한다")
    void chatWebSocketRoute() {
        RouteDefinition route = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "chat-websocket-rate-limited".equals(candidate.getId()))
            .blockFirst();

        assertThat(route).isNotNull();
        assertThat(route.getUri().getScheme()).isEqualTo("ws");
        assertThat(route.getPredicates()).singleElement()
            .satisfies(predicate -> assertThat(predicate.getArgs()).containsValue("/ws/chat"));
        assertThat(route.getFilters()).singleElement().satisfies(filter -> {
            assertThat(filter.getName()).isEqualTo("RequestRateLimiter");
            assertThat(filter.getArgs())
                .containsEntry("redis-rate-limiter.replenishRate", "10")
                .containsEntry("redis-rate-limiter.burstCapacity", "300")
                .containsEntry("redis-rate-limiter.requestedTokens", "60");
        });
    }

    @Test
    @DisplayName("채팅 메시지 POST route는 일반 proxy보다 먼저 IP당 120회/분 토큰버킷을 적용한다")
    void chatMessagePostRoute() {
        RouteDefinition route = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "chat-message-post-rate-limited".equals(candidate.getId()))
            .blockFirst();
        RouteDefinition serviceProxy = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "service-proxy".equals(candidate.getId()))
            .blockFirst();

        assertThat(route).isNotNull();
        assertThat(serviceProxy).isNotNull();
        assertThat(route.getOrder()).isLessThan(serviceProxy.getOrder());
        assertThat(route.getPredicates()).anySatisfy(predicate -> assertThat(predicate.getArgs())
            .containsValue("/api/v1/me/chat-rooms/{roomPublicId}/messages"));
        assertThat(route.getPredicates()).anySatisfy(predicate -> assertThat(predicate.getArgs())
            .containsValue("POST"));
        assertThat(route.getFilters()).singleElement().satisfies(filter -> {
            assertThat(filter.getName()).isEqualTo("RequestRateLimiter");
            assertThat(filter.getArgs())
                .containsEntry("redis-rate-limiter.replenishRate", "2")
                .containsEntry("redis-rate-limiter.burstCapacity", "120")
                .containsEntry("redis-rate-limiter.requestedTokens", "1");
        });
    }

    @Test
    @DisplayName("OAuth 경로는 service proxy보다 먼저 auth 토큰버킷을 적용한다")
    void oauthRouteUsesAuthRateLimiter() {
        RouteDefinition route = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "auth-rate-limited".equals(candidate.getId()))
            .blockFirst();
        assertThat(route).isNotNull();
        assertThat(route.getPredicates()).singleElement()
            .satisfies(predicate -> assertThat(predicate.getArgs()).containsValue("/api/v1/auth/oauth/**"));
        assertThat(route.getFilters()).singleElement().satisfies(filter -> {
            assertThat(filter.getName()).isEqualTo("RequestRateLimiter");
            assertThat(filter.getArgs())
                .containsEntry("redis-rate-limiter.replenishRate", "5")
                .containsEntry("redis-rate-limiter.burstCapacity", "10")
                .containsEntry("redis-rate-limiter.requestedTokens", "1");
        });
    }

    @Test
    @DisplayName("홈 추천 GET 전용 route는 일반 proxy보다 먼저 정확 경로에 rate limit을 적용한다")
    void homeRecommendationRouteUsesDedicatedRateLimiter() {
        RouteDefinition route = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "home-shop-recommendations-rate-limited".equals(candidate.getId()))
            .blockFirst();
        RouteDefinition serviceProxy = routeDefinitionLocator.getRouteDefinitions()
            .filter(candidate -> "service-proxy".equals(candidate.getId()))
            .blockFirst();

        assertThat(route).isNotNull();
        assertThat(serviceProxy).isNotNull();
        assertThat(route.getOrder()).isLessThan(serviceProxy.getOrder());
        assertThat(route.getPredicates()).anySatisfy(predicate -> assertThat(predicate.getArgs())
            .containsValue("/api/v1/home/shop-recommendations"));
        assertThat(route.getPredicates()).anySatisfy(predicate -> assertThat(predicate.getArgs())
            .containsValue("GET"));
        assertThat(route.getFilters()).singleElement().satisfies(filter -> {
            assertThat(filter.getName()).isEqualTo("RequestRateLimiter");
            assertThat(filter.getArgs())
                .containsEntry("key-resolver", "#{@clientIpKeyResolver}")
                .containsEntry("rate-limiter", "#{@homeRecommendationRateLimiter}")
                .containsEntry("redis-rate-limiter.replenishRate", "1")
                .containsEntry("redis-rate-limiter.burstCapacity", "10")
                .containsEntry("redis-rate-limiter.requestedTokens", "1");
        });
    }
}
