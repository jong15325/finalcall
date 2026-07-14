package com.finalcall.integration;

import com.finalcall.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 회원가입 엔드포인트 통합 검증(auth) — 실제 MySQL(Testcontainers) + Security 필터 체인.
 *
 * <p>계약 §2: 성공 201 {@code {userPublicId, nickname}}, 중복 loginId=AUTH_001(409)·nickname=AUTH_002(409).
 * ★ 각 테스트에 {@code @Transactional} 롤백을 걸어 커밋된 회원 데이터가 다음 테스트/재실행(컨테이너 reuse)로 새지 않게 한다.
 */
@Transactional
class SignupIntegrationTest extends IntegrationTest {

    private static final String SIGNUP_URL = "/api/v1/auth/signup";

    @Test
    void 가입에_성공하면_201과_publicId_nickname을_반환한다() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("hong", "pw12345678", "홍길동")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.userPublicId").isNotEmpty())
                .andExpect(jsonPath("$.data.nickname").value("홍길동"));
    }

    @Test
    void loginId_중복이면_409_AUTH_001() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("dupid", "pw12345678", "닉네임A")))
                .andExpect(status().isCreated());

        mockMvc.perform(post(SIGNUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("dupid", "pw12345678", "닉네임B")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH_001"));
    }

    @Test
    void nickname_중복이면_409_AUTH_002() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body("idA", "pw12345678", "같은닉네임")))
                .andExpect(status().isCreated());

        mockMvc.perform(post(SIGNUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("idB", "pw12345678", "같은닉네임")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.code").value("AUTH_002"));
    }

    @Test
    void 필수값_누락이면_400_검증에러() throws Exception {
        mockMvc.perform(post(SIGNUP_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("", "pw12345678", "닉네임")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errors").isArray());
    }

    private static String body(String loginId, String password, String nickname) {
        return """
                {"loginId":"%s","password":"%s","nickname":"%s"}
                """.formatted(loginId, password, nickname);
    }
}
