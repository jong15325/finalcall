package com.finalcall.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Redis 캐시 통합 검증(Stage F2, E1 연계).
 *
 * <p>@Cacheable 히트(같은 generatedAt) → @CacheEvict 무효화(다른 generatedAt)를 실제 Redis(Testcontainers)로 확인한다.
 * Redis 는 롤백되지 않으므로 base 의 @AfterEach flushDb 로 다음 테스트와 격리된다.
 */
class CacheIntegrationTest extends IntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 캐시_히트_후_evict_무효화() throws Exception {
        String first = getCached();
        String second = getCached();
        assertThat(generatedAt(second)).isEqualTo(generatedAt(first)); // 두 번째는 캐시 히트

        mockMvc.perform(delete("/sample/cache/1")).andExpect(status().isOk());

        String third = getCached();
        assertThat(generatedAt(third)).isNotEqualTo(generatedAt(first)); // evict 후 재생성
    }

    private String getCached() throws Exception {
        return mockMvc.perform(get("/sample/cache/1"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private String generatedAt(String body) throws Exception {
        JsonNode node = objectMapper.readTree(body);
        return node.get("data").get("generatedAt").asText();
    }
}
