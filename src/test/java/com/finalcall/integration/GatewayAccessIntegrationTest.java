package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import com.finalcall.support.IntegrationTest;

/**
 * 직접접근 차단 통합 검증(D-068) — 서비스 측 {@link com.finalcall.infra.security.GatewayAccessFilter}.
 *
 * <p>base 의 {@code enforced=false} 를 여기서만 {@code true} 로 오버라이드하고 결정적 공유비밀을 주입해
 * 실제 차단 동작을 검증한다. 게이트웨이 경유(=올바른 헤더) 여부만 판정하므로 이후 인증 결과(401)는 통과 신호다.
 */
@TestPropertySource(properties = {
    "gateway.internal.enforced=true",
    "gateway.internal.secret=test-gateway-secret"
})
class GatewayAccessIntegrationTest extends IntegrationTest {

    private static final String GATEWAY_HEADER = "X-Gateway-Token";
    private static final String GATEWAY_SECRET = "test-gateway-secret";
    private static final String LOGIN_URL = "/api/v1/auth/login";

    @Test
    @DisplayName("공유비밀 헤더가 없으면 게이트웨이를 거치지 않은 직접접근으로 보고 403 GATEWAY_403 을 반환한다")
    void 헤더가_없으면_403() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"nobody","password":"pw12345678"}
                """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("GATEWAY_403"))
            .andExpect(jsonPath("$.errors").doesNotExist());
    }

    @Test
    @DisplayName("공유비밀 헤더가 틀리면 403 GATEWAY_403 을 반환한다")
    void 헤더가_틀리면_403() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
            .header(GATEWAY_HEADER, "wrong-secret")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"nobody","password":"pw12345678"}
                """))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("GATEWAY_403"));
    }

    @Test
    @DisplayName("올바른 공유비밀 헤더면 차단을 통과한다(이후 인증 단계로 진행 — 없는 사용자 401 AUTH_003)")
    void 올바른_헤더면_통과한다() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
            .header(GATEWAY_HEADER, GATEWAY_SECRET)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"nobody","password":"pw12345678"}
                """))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("AUTH_003"));
    }

    @Test
    @DisplayName("actuator 경로는 공유비밀 헤더 없이도 차단에서 제외된다(헬스체크·프로브)")
    void actuator_는_헤더_없이_통과한다() throws Exception {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk());
    }
}
