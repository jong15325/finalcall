package com.finalcall.integration;

import com.finalcall.common.security.TokenProvider;
import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인증 걸린 엔드포인트 테스트 규약(Stage F2, F1 연계).
 *
 * <p>★ 필터 로직 검증(검증/거부)은 실제 토큰으로 end-to-end, 그 외 인증 전제 검증은 @WithMockUser 로.
 */
class AuthIntegrationTest extends IntegrationTest {

    @Autowired
    private TokenProvider tokenProvider;

    @Test
    void 토큰없이_보호경로는_401_표준에러() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("COMMON_005"));
    }

    @Test
    void 실제토큰으로_보호경로_접근성공() throws Exception {
        // JwtAuthenticationFilter 를 실제로 통과시키는 end-to-end 검증.
        String token = tokenProvider.generateToken("tester");
        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("tester"));
    }

    @Test
    @WithMockUser(username = "mockuser")
    void WithMockUser_로_보호경로_접근성공() throws Exception {
        // 필터를 거치지 않고 SecurityContext 를 가짜 인증으로 채우는 간편 방식.
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("mockuser"));
    }
}
