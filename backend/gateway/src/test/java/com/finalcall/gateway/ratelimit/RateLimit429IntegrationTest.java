package com.finalcall.gateway.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.EntityExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 엣지 rate limit 429 동적 검증(델타 3, D-068) — {@link com.finalcall.gateway.filter.RateLimitResponseGlobalFilter}.
 *
 * <p>실제 Redis(Testcontainers)로 RequestRateLimiter 토큰버킷을 구동하고, 인증 경로에 버스트 상한을 초과하는
 * 요청을 몰아 실제 429 를 유발한다. 429 응답이 계약 [1.6] envelope(success·code·message·timestamp 4필드,
 * errors 미포함)와 {@code Retry-After} 헤더를 갖추는지 검증한다.
 *
 * <p>local 프로파일 기본값(공유비밀·service.uri)을 그대로 쓰고 Redis 주소만 컨테이너로 오버라이드한다.
 * 허용된 요청은 미기동 하류(service.uri)로의 프록시가 실패하지만, 관심사는 rate limit 초과로 <b>단락된</b>
 * 429 응답이므로 무관하다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class RateLimit429IntegrationTest {

    private static final String LOGIN_URL = "/api/v1/auth/oauth/naver";
    private static final String LOGIN_BODY = "{\"code\":\"one-time-code\",\"redirectUri\":\"http://localhost:5173/oauth/callback\"}";
    /** 버스트(10) + replenish 여유를 확실히 초과하도록 넉넉히 몰아친다. */
    private static final int BURST_ATTEMPTS = 60;

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7"))
        .withExposedPorts(6379);

    @DynamicPropertySource
    static void redisProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    @DisplayName("버스트 초과 시 429 응답이 GATEWAY_429 envelope(4필드·errors 미포함)와 Retry-After 헤더를 반환한다")
    void 버스트_초과_429_envelope() throws Exception {
        WebTestClient client = WebTestClient.bindToServer()
            .baseUrl("http://localhost:" + port)
            .build();

        EntityExchangeResult<byte[]> tooManyRequests = null;
        for (int i = 0; i < BURST_ATTEMPTS && tooManyRequests == null; i++) {
            EntityExchangeResult<byte[]> result = client.post()
                .uri(LOGIN_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(LOGIN_BODY)
                .exchange()
                .expectBody(byte[].class)
                .returnResult();
            if (result.getStatus() == HttpStatus.TOO_MANY_REQUESTS) {
                tooManyRequests = result;
            }
        }

        assertThat(tooManyRequests)
            .as("버스트 %d회 내에 429가 트리거되어야 한다", BURST_ATTEMPTS)
            .isNotNull();

        // Retry-After 헤더 동반(계약 [1.6]).
        assertThat(tooManyRequests.getResponseHeaders().getFirst(HttpHeaders.RETRY_AFTER))
            .isEqualTo("1");

        byte[] rawBody = tooManyRequests.getResponseBodyContent();
        assertThat(rawBody).as("429 응답 본문이 있어야 한다").isNotEmpty();
        String json = new String(rawBody, StandardCharsets.UTF_8);

        // envelope 정확히 4필드(success·code·message·timestamp), errors 미포함.
        Map<String, Object> body = objectMapper.readValue(rawBody, new TypeReferenceMap());
        assertThat(body).containsOnlyKeys("success", "code", "message", "timestamp");
        assertThat(body.get("success")).isEqualTo(false);
        assertThat(body.get("code")).isEqualTo("GATEWAY_429");
        assertThat(body.get("message")).isInstanceOf(String.class);
        assertThat((String)body.get("message")).isNotBlank();
        assertThat(body).doesNotContainKey("errors");
        // timestamp 는 ISO-8601 UTC(Instant) — 't'/'Z' 포함 문자열.
        assertThat(body.get("timestamp")).isInstanceOf(String.class);
        assertThat((String)body.get("timestamp")).contains("T").endsWith("Z");

        // 필드 순서 = 계약 [1.6](success → code → message → timestamp).
        assertThat(json.indexOf("success"))
            .isLessThan(json.indexOf("code"));
        assertThat(json.indexOf("code"))
            .isLessThan(json.indexOf("message"));
        assertThat(json.indexOf("message"))
            .isLessThan(json.indexOf("timestamp"));
    }

    /** {@code Map<String,Object>} 역직렬화용 TypeReference(제네릭 소거 회피). */
    private static final class TypeReferenceMap
        extends com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>> {
    }
}
