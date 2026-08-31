package com.finalcall.gateway.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import reactor.netty.DisposableServer;
import reactor.netty.http.server.HttpServer;

/** 홈 추천 rate limiter가 Redis 장애 시 하류로 우회하지 않는 fail-closed 동작을 검증한다. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HomeRecommendationRedisFailureIntegrationTest {

    private static final AtomicInteger DOWNSTREAM_REQUESTS = new AtomicInteger();
    private static final DisposableServer DOWNSTREAM = HttpServer.create()
        .host("127.0.0.1")
        .port(0)
        .handle((request, response) -> {
            DOWNSTREAM_REQUESTS.incrementAndGet();
            return response.status(200).send();
        })
        .bindNow();

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("service.uri", () -> "http://127.0.0.1:" + DOWNSTREAM.port());
        registry.add("spring.data.redis.host", () -> "127.0.0.1");
        registry.add("spring.data.redis.port", () -> 1);
        registry.add("spring.data.redis.connect-timeout", () -> "100ms");
        registry.add("spring.data.redis.timeout", () -> "100ms");
    }

    @AfterAll
    static void stopDownstream() {
        DOWNSTREAM.disposeNow();
    }

    @LocalServerPort
    private int port;

    @Test
    void Redis_장애이면_하류로_전달하지_않고_실패한다() {
        DOWNSTREAM_REQUESTS.set(0);
        WebTestClient.bindToServer()
            .baseUrl("http://localhost:" + port)
            .responseTimeout(java.time.Duration.ofSeconds(5))
            .build()
            .get()
            .uri("/api/v1/home/shop-recommendations")
            .exchange()
            .expectStatus().isEqualTo(429)
            .expectHeader().valueEquals(HttpHeaders.RETRY_AFTER, "1");

        assertThat(DOWNSTREAM_REQUESTS).hasValue(0);
    }

    @Test
    void Redis_장애여도_기존_auth_route의_기본_limiter_정책은_유지한다() {
        DOWNSTREAM_REQUESTS.set(0);
        WebTestClient.bindToServer()
            .baseUrl("http://localhost:" + port)
            .responseTimeout(java.time.Duration.ofSeconds(5))
            .build()
            .post()
            .uri("/api/v1/auth/oauth/naver")
            .exchange()
            .expectStatus().isOk();

        assertThat(DOWNSTREAM_REQUESTS).hasValue(1);
    }
}
