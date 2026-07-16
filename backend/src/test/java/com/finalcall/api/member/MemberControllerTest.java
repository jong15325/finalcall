package com.finalcall.api.member;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.member.MemberService;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.infra.config.GatewayInternalProperties;
import com.finalcall.infra.config.SecurityConfig;
import com.finalcall.infra.security.JwtAccessDeniedHandler;
import com.finalcall.infra.security.JwtAuthenticationEntryPoint;

/**
 * {@link MemberController} 슬라이스 테스트(@WebMvcTest) — 실제 SecurityConfig 필터 체인을 얹어 인증 경로까지 검증한다.
 *
 * <p>{@link SecurityConfig} 를 임포트해 {@code /api/v1/me/balance} 가 인증을 요구하는지(401)와, 인증 시 계약 [4.4]
 * 4필드가 정확히 실리는지 확인한다. {@link MemberService} 는 모의해 컨트롤러 매핑·응답 변환만 좁게 검증한다.
 */
@WebMvcTest(MemberController.class)
@Import({SecurityConfig.class, JwtAuthenticationEntryPoint.class, JwtAccessDeniedHandler.class,
    MemberControllerTest.SecurityTestBeans.class})
class MemberControllerTest {

    private static final String BALANCE_URL = "/api/v1/me/balance";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MemberService memberService;

    // SecurityConfig 협력자 — 필터 체인 구성에만 필요(요청 경로에서 호출되지 않음).
    @MockBean
    private TokenProvider tokenProvider;

    @Test
    void 인증된_사용자는_잔액_4필드를_반환받는다() throws Exception {
        when(memberService.getMyBalance()).thenReturn(balanceOf(1000L, 500L, 200L));

        mockMvc.perform(get(BALANCE_URL).with(user("42")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.cashBalance").value(1000))
            .andExpect(jsonPath("$.data.gameMoneyBalance").value(500))
            .andExpect(jsonPath("$.data.gameMoneyHeld").value(200))
            .andExpect(jsonPath("$.data.gameMoneyAvailable").value(300)); // 파생값 = 잔액 − 홀드
    }

    @Test
    void 미인증_요청은_401이다() throws Exception {
        mockMvc.perform(get(BALANCE_URL))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_005"));
    }

    private static UserBalance balanceOf(long cash, long gameMoney, long held) {
        User user = User.builder().loginId("hong").passwordHash("hash").nickname("홍길동").build();
        UserBalance balance = UserBalance.builder().user(user).build();
        balance.addCash(cash);
        balance.addGameMoney(gameMoney);
        balance.hold(held);
        return balance;
    }

    /** SecurityConfig 가 요구하는 GatewayInternalProperties 를 검사 비활성(enforced=false)으로 제공한다. */
    @TestConfiguration
    static class SecurityTestBeans {

        @Bean
        GatewayInternalProperties gatewayInternalProperties() {
            return new GatewayInternalProperties("test-secret", null, false);
        }
    }
}
