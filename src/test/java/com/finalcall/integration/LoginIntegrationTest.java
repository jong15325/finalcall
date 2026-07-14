package com.finalcall.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.infra.security.RefreshTokenStore;
import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 로그인 엔드포인트 통합 검증(auth) — 실제 MySQL/Redis(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §2: 성공 200 {@code {accessToken, refreshToken, accessExpiresAt}}, 실패 단일 코드 AUTH_003(401).
 * ★ @Transactional 롤백으로 가입 데이터를 격리한다(Redis 는 base @AfterEach flushDb).
 */
@Transactional
class LoginIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";
    private static final String LOGIN_URL = "/api/v1/auth/login";

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RefreshTokenStore refreshTokenStore;

    @Test
    void 로그인에_성공하면_200과_토큰을_반환하고_refresh가_저장된다() throws Exception {
        signup("hong", "pw12345678", "홍길동");

        String responseBody = mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("hong", "pw12345678")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.accessExpiresAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

        // 발급된 refresh 가 실제로 저장돼 검증에 통과하는지 확인(B-011).
        JsonNode data = objectMapper.readTree(responseBody).get("data");
        String refreshToken = data.get("refreshToken").asText();
        assertThat(refreshTokenStore.validate(refreshToken)).isPresent();
    }

    @Test
    void 비밀번호가_틀리면_401_AUTH_003() throws Exception {
        signup("hong", "pw12345678", "홍길동");

        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("hong", "wrong-pw")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH_003"));
    }

    @Test
    void 없는_사용자면_401_AUTH_003() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody("nobody", "pw12345678")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH_003"));
    }

    private void signup(String loginId, String password, String nickname) throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"loginId":"%s","password":"%s","nickname":"%s"}
                                """.formatted(loginId, password, nickname)))
                .andExpect(status().isCreated());
    }

    private static String loginBody(String loginId, String password) {
        return """
                {"loginId":"%s","password":"%s"}
                """.formatted(loginId, password);
    }
}
