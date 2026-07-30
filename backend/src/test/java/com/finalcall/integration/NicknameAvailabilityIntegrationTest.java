package com.finalcall.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.support.IntegrationTest;

/**
 * 닉네임 가용성 조회 엔드포인트 통합 검증(auth, EPIC-NICKNAME-UX v1.17) — 실제 MySQL(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §2: 인증 불요(permitAll, 인증 헤더 없이 200)·미존재=available true·존재(가입 후)=available false·형식/길이
 * 위반=400 errors[]. 판정은 가입 유니크 검사와 동일 경로(existsByNicknameAndIsDeletedFalse)라 조회↔가입이 드리프트하지 않는다.
 * ★ 커밋된 회원 데이터가 다음 테스트로 새지 않게 {@code @Transactional} 롤백을 건다.
 */
@Transactional
class NicknameAvailabilityIntegrationTest extends IntegrationTest {

    private static final String AVAILABILITY_URL = "/api/v1/auth/nickname/availability";
    private static final String SIGNUP_URL = "/api/v1/auth/signup";

    @Test
    void 미존재_닉네임은_인증없이_available_true를_반환한다() throws Exception {
        mockMvc.perform(get(AVAILABILITY_URL).param("nickname", "안쓰는닉네임"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.available").value(true));
    }

    @Test
    void 이미_가입된_닉네임은_available_false를_반환한다() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"loginId":"nickowner","password":"pw12345678","nickname":"점유된닉"}
                """))
            .andExpect(status().isCreated());

        mockMvc.perform(get(AVAILABILITY_URL).param("nickname", "점유된닉"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.available").value(false));
    }

    @Test
    void 공백_닉네임은_400_검증에러() throws Exception {
        mockMvc.perform(get(AVAILABILITY_URL).param("nickname", "  "))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void 길이초과_닉네임은_400_검증에러() throws Exception {
        mockMvc.perform(get(AVAILABILITY_URL).param("nickname", "가".repeat(31)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.errors").isArray());
    }
}
