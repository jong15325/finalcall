package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.support.IntegrationTest;

/**
 * 토큰 재발급 엔드포인트 통합 검증(auth) — 실제 MySQL/Redis(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §2 v1.1: 성공 200 {@code {accessToken, refreshToken(회전), accessExpiresAt}}, 무효·재사용·만료는 AUTH_004(401).
 * ★ @Transactional 롤백으로 가입 데이터 격리(Redis 는 base @AfterEach flushDb).
 */
@Transactional
class RefreshIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";
    private static final String LOGIN_URL = "/api/v1/auth/login";
    private static final String REFRESH_URL = "/api/v1/auth/refresh";

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 재발급에_성공하면_200과_회전된_신규_토큰을_반환한다() throws Exception {
        String refresh = signupAndLogin("hong", "pw12345678", "홍길동");

        String body = mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(refresh)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
            .andExpect(jsonPath("$.data.accessExpiresAt").isNotEmpty())
            .andReturn().getResponse().getContentAsString();

        // 회전된 신규 refresh 는 제시분과 달라야 한다.
        org.assertj.core.api.Assertions.assertThat(refreshTokenOf(body)).isNotEqualTo(refresh);
    }

    @Test
    void 회전으로_폐기된_옛_refresh_재사용은_401_AUTH_004이고_세션이_무효화된다() throws Exception {
        String refresh = signupAndLogin("hong", "pw12345678", "홍길동");

        // 1차 재발급(회전) → 신규 refresh 획득.
        String rotatedBody = mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(refresh)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String rotated = refreshTokenOf(rotatedBody);

        // 폐기된 옛 refresh 재사용 → 401 AUTH_004(재사용 탐지).
        mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(refresh)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTH_004"));

        // 재사용 탐지로 세션 무효화 → 방금 회전한 신규 refresh 도 더 이상 유효하지 않다.
        mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(rotated)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTH_004"));
    }

    @Test
    void 형식이_잘못된_refresh는_401_AUTH_004() throws Exception {
        mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody("garbage-token")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTH_004"));
    }

    /** 가입 후 로그인해 refresh 원문을 돌려준다. */
    private String signupAndLogin(String loginId, String password, String nickname) throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"%s","password":"%s","nickname":"%s"}
                """.formatted(loginId, password, nickname)))
            .andExpect(status().isCreated());
        String body = mockMvc.perform(post(LOGIN_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"%s","password":"%s"}
                """.formatted(loginId, password)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return refreshTokenOf(body);
    }

    private String refreshTokenOf(String responseBody) throws Exception {
        JsonNode data = objectMapper.readTree(responseBody).get("data");
        return data.get("refreshToken").asText();
    }

    private static String refreshBody(String refreshToken) {
        return """
            {"refreshToken":"%s"}
            """.formatted(refreshToken);
    }
}
