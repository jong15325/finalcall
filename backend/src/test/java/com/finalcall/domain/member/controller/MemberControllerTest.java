package com.finalcall.domain.member.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.exception.MemberErrorCode;
import com.finalcall.common.security.TokenProvider;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.service.MemberService;
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
    private static final String ME_URL = "/api/v1/me";

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

    @Test
    void 프로필_조회는_계약_4필드를_반환한다() throws Exception {
        when(memberService.getMyProfile()).thenReturn(profileUser("홍길동", false));

        mockMvc.perform(get(ME_URL).with(user("42")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.userPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.nickname").value("홍길동"))
            .andExpect(jsonPath("$.data.primaryCharacterId").value(1))
            .andExpect(jsonPath("$.data.isAdmin").value(false)) // record boolean → 계약 키 'isAdmin' 유지
            .andExpect(jsonPath("$.data.createdAt").value("2026-07-17T00:00:00Z"));
    }

    @Test
    void 프로필_조회_미인증은_401이다() throws Exception {
        mockMvc.perform(get(ME_URL))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("COMMON_005"));
    }

    @Test
    void 탈퇴계정_주체의_프로필_조회는_세션무효로_401_COMMON_005() throws Exception {
        // 활성 행 부재(탈퇴 계정, 만료 전 access) → 서비스가 401(COMMON_005) 던짐. EntryPoint 미인증 401 과 동일 포맷.
        when(memberService.getMyProfile()).thenThrow(new BusinessException(CommonErrorCode.UNAUTHORIZED));

        mockMvc.perform(get(ME_URL).with(user("42")))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("COMMON_005"));
    }

    @Test
    void 프로필_수정_성공은_수정된_스키마를_반환한다() throws Exception {
        when(memberService.updateProfile("새닉네임", null)).thenReturn(profileUser("새닉네임", false));

        mockMvc.perform(patch(ME_URL).with(user("42"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"새닉네임\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.nickname").value("새닉네임"))
            .andExpect(jsonPath("$.data.isAdmin").value(false));
    }

    @Test
    void 기본_캐릭터만_부분_수정할_수_있다() throws Exception {
        User user = profileUser("그대로", false);
        user.changePrimaryCharacter(25);
        when(memberService.updateProfile(null, 25)).thenReturn(user);

        mockMvc.perform(patch(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryCharacterId\":25}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.nickname").value("그대로"))
            .andExpect(jsonPath("$.data.primaryCharacterId").value(25));
    }

    @Test
    void 프로필_빈_요청과_명시적_null은_400이다() throws Exception {
        mockMvc.perform(patch(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
            .andExpect(status().isBadRequest());

        mockMvc.perform(patch(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryCharacterId\":null}"))
            .andExpect(status().isBadRequest());

        verify(memberService, never()).updateProfile(any(), any());
    }

    @Test
    void 프로필_알_수_없는_필드는_400이다() throws Exception {
        mockMvc.perform(patch(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"primaryCharacterId\":12,\"unknown\":true}"))
            .andExpect(status().isBadRequest());

        verify(memberService, never()).updateProfile(any(), any());
    }

    @Test
    void 기본_캐릭터_범위_위반은_MEMBER_003이다() throws Exception {
        when(memberService.updateProfile(null, 29))
            .thenThrow(new BusinessException(MemberErrorCode.MEMBER_INVALID_PRIMARY_CHARACTER));

        mockMvc.perform(patch(ME_URL).with(user("42"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"primaryCharacterId\":29}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MEMBER_003"));
    }

    @Test
    void int_범위를_넘는_기본_캐릭터는_wrap하지_않고_MEMBER_003이다() throws Exception {
        when(memberService.updateProfile(null, 0))
            .thenThrow(new BusinessException(MemberErrorCode.MEMBER_INVALID_PRIMARY_CHARACTER));

        mockMvc.perform(patch(ME_URL).with(user("42"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"primaryCharacterId\":4294967297}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MEMBER_003"));

        mockMvc.perform(patch(ME_URL).with(user("42"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"primaryCharacterId\":4294967321}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MEMBER_003"));

        verify(memberService, org.mockito.Mockito.times(2)).updateProfile(null, 0);
    }

    @Test
    void 프로필_수정_빈닉네임은_400이다() throws Exception {
        mockMvc.perform(patch(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"nickname\":\"\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        verify(memberService, never()).updateProfile(any(), any());
    }

    @Test
    void 프로필_수정_닉네임중복은_MEMBER_001이다() throws Exception {
        when(memberService.updateProfile("중복닉", null))
            .thenThrow(new BusinessException(MemberErrorCode.MEMBER_DUPLICATE_NICKNAME));

        mockMvc.perform(patch(ME_URL).with(user("42"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"중복닉\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("MEMBER_001"));
    }

    @Test
    void 탈퇴_동의시_204이고_서비스를_호출한다() throws Exception {
        mockMvc.perform(delete(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"balanceForfeitAcknowledged\":true}"))
            .andExpect(status().isNoContent());

        verify(memberService).withdraw();
    }

    @Test
    void 탈퇴_동의누락은_400이고_서비스를_호출하지_않는다() throws Exception {
        mockMvc.perform(delete(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        verify(memberService, never()).withdraw();
    }

    @Test
    void 탈퇴_동의가_false면_400이다() throws Exception {
        mockMvc.perform(delete(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"balanceForfeitAcknowledged\":false}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        verify(memberService, never()).withdraw();
    }

    @Test
    void 탈퇴_진행중거래시_MEMBER_002이다() throws Exception {
        org.mockito.Mockito.doThrow(new BusinessException(MemberErrorCode.MEMBER_WITHDRAW_BLOCKED_BY_ACTIVE_TRADE))
            .when(memberService).withdraw();

        mockMvc.perform(delete(ME_URL).with(user("42"))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"balanceForfeitAcknowledged\":true}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("MEMBER_002"));
    }

    /** publicId 는 생성자에서 ULID 로 채워지고, createdAt 은 감사 컬럼이라 테스트에서 리플렉션으로 세팅한다. */
    private static User profileUser(String nickname, boolean isAdmin) {
        User user = User.builder().loginId("hong").passwordHash("hash").nickname(nickname).isAdmin(isAdmin).build();
        ReflectionTestUtils.setField(user, "createdAt", Instant.parse("2026-07-17T00:00:00Z"));
        return user;
    }

    private static UserBalance balanceOf(long cash, long gameMoney, long held) {
        User user = User.builder().loginId("hong").passwordHash("hash").nickname("홍길동").build();
        UserBalance balance = UserBalance.builder().user(user).build();
        // 잔액 증감은 리포지토리 원자 UPDATE 경로라 엔티티 세터가 없다 → 픽스처는 리플렉션으로 상태를 세팅한다.
        ReflectionTestUtils.setField(balance, "cashBalance", cash);
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        ReflectionTestUtils.setField(balance, "gameMoneyHeld", held);
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
