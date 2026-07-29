package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.finalcall.support.IntegrationTest;

/**
 * 소셜 로그인 엔드포인트 배선 검증(auth, FC-154) — Security 필터 체인 통과(permitAll) + 컨트롤러·전역 핸들러 정합.
 *
 * <p>provider 호출이 필요 없는 경로만 통합에서 덮는다: 미지원 provider(AUTH_006)·검증 실패(400). 실제 provider
 * 교환(성공·AUTH_007/008)은 라이브 키·외부 호출이 필요해 {@code OAuthProviderStrategyTest}(RestClient 목)가 전담한다.
 * 이 테스트의 핵심은 {@code /api/v1/auth/oauth/**} 가 인증 없이(permitAll) 도달 가능함을 확인하는 것이다.
 */
class OAuthApiIntegrationTest extends IntegrationTest {

    private static final String OAUTH_URL = "/api/v1/auth/oauth/";

    @Test
    void 미지원_provider_는_400_AUTH_006() throws Exception {
        mockMvc.perform(post(OAUTH_URL + "google")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"code":"authcode-1","redirectUri":"http://localhost:5173/oauth/callback"}
                """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("AUTH_006"));
    }

    @Test
    void code_누락은_400_검증() throws Exception {
        mockMvc.perform(post(OAUTH_URL + "naver")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"redirectUri":"http://localhost:5173/oauth/callback"}
                """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_001"));
    }

    @Test
    void redirectUri_누락은_400_검증() throws Exception {
        mockMvc.perform(post(OAUTH_URL + "naver")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"code":"authcode-1"}
                """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_001"));
    }
}
