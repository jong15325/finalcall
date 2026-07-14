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
 * 로그아웃 엔드포인트 통합 검증(auth) — 실제 MySQL/Redis(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §2: 인증 필요, 성공 204(본문 없음), 폐기 후 동일 refresh 는 AUTH_004 로 차단(B-011).
 * ★ @Transactional 롤백으로 가입 데이터 격리(Redis 는 base @AfterEach flushDb).
 */
@Transactional
class LogoutIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";
    private static final String LOGIN_URL = "/api/v1/auth/login";
    private static final String REFRESH_URL = "/api/v1/auth/refresh";
    private static final String LOGOUT_URL = "/api/v1/auth/logout";

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void 로그아웃하면_204이고_이후_동일_refresh는_AUTH_004로_차단된다() throws Exception {
        JsonNode tokens = signupAndLogin("hong", "pw12345678", "홍길동");
        String accessToken = tokens.get("accessToken").asText();
        String refreshToken = tokens.get("refreshToken").asText();

        mockMvc.perform(post(LOGOUT_URL)
            .header("Authorization", "Bearer " + accessToken)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(refreshToken)))
            .andExpect(status().isNoContent());

        // 폐기된 세션의 refresh 는 재발급에서 차단된다.
        mockMvc.perform(post(REFRESH_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody(refreshToken)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTH_004"));
    }

    @Test
    void 인증없이_로그아웃은_401() throws Exception {
        mockMvc.perform(post(LOGOUT_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(refreshBody("any.refresh.token")))
            .andExpect(status().isUnauthorized());
    }

    /** 가입 후 로그인해 {accessToken, refreshToken} 노드를 돌려준다. */
    private JsonNode signupAndLogin(String loginId, String password, String nickname) throws Exception {
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
        return objectMapper.readTree(body).get("data");
    }

    private static String refreshBody(String refreshToken) {
        return """
            {"refreshToken":"%s"}
            """.formatted(refreshToken);
    }
}
