package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 재가입 시나리오 통합 검증(member/auth) — 실제 MySQL(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 [2.5]·D-081: soft delete 후 동일 login_id·nickname 재가입이 허용되고, 재가입 계정으로 로그인이
 * 성공(다건 반환 파손 부재)하는지 확인한다. {@code DELETE /me}는 아직 없어 탈퇴 상태는 리포지토리 레벨로 만든다.
 * ★ 각 테스트에 {@code @Transactional} 롤백을 걸어 커밋된 회원 데이터가 다음 테스트/재실행(컨테이너 reuse)으로 새지 않게 한다.
 */
@Transactional
class ReSignupIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";
    private static final String LOGIN_URL = "/api/v1/auth/login";

    @Autowired
    private UserRepository userRepository;

    @Test
    void 탈퇴후_동일_loginId_nickname_재가입이_성공한다() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(signupBody("reuser", "pw12345678", "재사용닉")))
            .andExpect(status().isCreated());

        softDelete("reuser");

        // 동일 login_id·nickname 으로 재가입 → 생성 컬럼 UK 가 탈퇴행을 비켜가 201.
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(signupBody("reuser", "pw12345678", "재사용닉")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.nickname").value("재사용닉"));
    }

    @Test
    void 재가입_계정으로_로그인이_성공한다_다건_파손_부재() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(signupBody("relogin", "pw12345678", "재로그인닉")))
            .andExpect(status().isCreated());
        softDelete("relogin");
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(signupBody("relogin", "pw12345678", "재로그인닉")))
            .andExpect(status().isCreated());

        // 탈퇴행+활성행이 동일 login_id 로 공존해도 활성 조회는 단건 → 로그인 200(IncorrectResultSize 파손 없음).
        mockMvc.perform(post(LOGIN_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content(loginBody("relogin", "pw12345678")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.data.refreshToken").isNotEmpty());
    }

    /** 리포지토리 레벨로 활성 회원을 soft delete 한다(DELETE /me 미구현 대체). saveAndFlush 로 login_id_active 를 NULL 로 만든다. */
    private void softDelete(String loginId) {
        User user = userRepository.findByLoginIdAndIsDeletedFalse(loginId).orElseThrow();
        user.delete();
        userRepository.saveAndFlush(user);
    }

    private static String signupBody(String loginId, String password, String nickname) {
        return """
            {"loginId":"%s","password":"%s","nickname":"%s"}
            """.formatted(loginId, password, nickname);
    }

    private static String loginBody(String loginId, String password) {
        return """
            {"loginId":"%s","password":"%s"}
            """.formatted(loginId, password);
    }
}
