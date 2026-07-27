package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.security.EmailVerificationCodeStore;
import com.finalcall.support.IntegrationTest;

/**
 * 이메일 설정·인증 엔드포인트 3종 + /me 노출 통합 검증(member, EPIC-EMAIL-VERIFY B7) — 실제 MySQL/Redis
 * (Testcontainers) + Security 필터. 계약 §4.2~§4.5. 상태코드(200/202/200)·응답 형상·/me 마스킹(원문 미노출)을
 * 고정한다.
 *
 * <p><b>@Transactional 롤백을 쓰지 않는다</b>: {@code verification-request}·{@code verify} 서비스는 SMTP·Redis I/O 를
 * 트랜잭션 밖에서 처리하려 {@code NOT_SUPPORTED} 로 실행되므로, 픽스처가 커밋돼 있어야 서비스 조회에 보인다. 따라서
 * 회원을 커밋 생성하고 {@code @AfterEach} 에서 정리한다(잔액 행 없이 생성 — 이메일 경로는 잔액을 참조하지 않는다).
 * 로컬 프로파일 {@code sender-enabled=false} 라 실제 SMTP 는 호출되지 않는다(LoggingEmailSender).
 */
class MeEmailApiIntegrationTest extends IntegrationTest {

    private static final String EMAIL_URL = "/api/v1/me/email";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailVerificationCodeStore codeStore;

    private final List<Long> createdUserIds = new ArrayList<>();

    @AfterEach
    void cleanupUsers() {
        userRepository.deleteAll(userRepository.findAllById(createdUserIds));
        createdUserIds.clear();
    }

    @Test
    void 이메일_설정은_200과_정규화된_email_emailVerified_false를_반환한다() throws Exception {
        User user = createUser("email_set_1", null);

        // @Email 은 앞뒤 공백을 형식 오류(400)로 막으므로 요청은 공백 없는 값으로 보낸다 — 대소문자 정규화만 확인
        // (trim 정규화는 서비스 단위 테스트가 담당).
        mockMvc.perform(put(EMAIL_URL).with(user(String.valueOf(user.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"Setter@Naver.COM\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.email").value("setter@naver.com")) // lowercase 에코
            .andExpect(jsonPath("$.data.emailVerified").value(false));
    }

    @Test
    void GET_me는_이메일을_마스킹해_노출하고_원문은_싣지않는다() throws Exception {
        User user = createUser("email_me_1", "masked@naver.com");

        mockMvc.perform(get("/api/v1/me").with(user(String.valueOf(user.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.emailVerified").value(false))
            .andExpect(jsonPath("$.data.emailMasked").value("m***@naver.com")) // 로컬파트 첫 글자만
            .andExpect(jsonPath("$.data.email").doesNotExist()); // 원문 미노출
    }

    @Test
    void 이메일_미설정_상태의_발송요청은_409_EMAIL_006() throws Exception {
        User user = createUser("email_req_none", null);

        mockMvc.perform(post(EMAIL_URL + "/verification-request").with(user(String.valueOf(user.getId()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("EMAIL_006"));
    }

    @Test
    void 이메일_설정된_발송요청은_202이다() throws Exception {
        User user = createUser("email_req_ok", "req@naver.com");

        mockMvc.perform(post(EMAIL_URL + "/verification-request").with(user(String.valueOf(user.getId()))))
            .andExpect(status().isAccepted()); // 202, 본문 없음
    }

    @Test
    void 올바른_코드로_확인하면_200과_emailVerified_true를_반환한다() throws Exception {
        User user = createUser("email_verify_ok", "verify@naver.com");
        String code = codeStore.issue(String.valueOf(user.getId()), "verify@naver.com").orElseThrow();

        mockMvc.perform(post(EMAIL_URL + "/verify").with(user(String.valueOf(user.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + code + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.emailVerified").value(true));

        // 인증이 커밋돼 /me 에도 반영된다.
        mockMvc.perform(get("/api/v1/me").with(user(String.valueOf(user.getId()))))
            .andExpect(jsonPath("$.data.emailVerified").value(true));
    }

    @Test
    void 틀린_코드로_확인하면_422_EMAIL_001() throws Exception {
        User user = createUser("email_verify_bad", "bad@naver.com");
        String issued = codeStore.issue(String.valueOf(user.getId()), "bad@naver.com").orElseThrow();
        String wrong = issued.equals("000000") ? "111111" : "000000"; // 발급값과 확정적으로 다른 6자리

        mockMvc.perform(post(EMAIL_URL + "/verify").with(user(String.valueOf(user.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + wrong + "\"}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("EMAIL_001"));
    }

    @Test
    void 인증확정_조건부UPDATE는_이메일_일치시에만_반영하고_트랜잭션이_적용된다() {
        User user = createUser("email_cond", "cond@naver.com");
        Long id = user.getId();

        // (1) 검증한 이메일과 다른 조건(검증~커밋 사이 setEmail 로 바뀐 상황) → 0행 → verified 반영 안 됨(M-1).
        //     @Modifying 쿼리는 tx 가 없으면 예외지만 리포지토리 @Transactional 로 정상 실행됨을 함께 실증한다.
        int stale = userRepository.markEmailVerified(id, "changed@naver.com");
        assertThat(stale).isZero();
        assertThat(userRepository.findById(id).orElseThrow().isEmailVerified()).isFalse();

        // (2) 현재 이메일과 일치 → 1행, verified 커밋(재조회로 실제 반영 확인).
        int applied = userRepository.markEmailVerified(id, "cond@naver.com");
        assertThat(applied).isEqualTo(1);
        assertThat(userRepository.findById(id).orElseThrow().isEmailVerified()).isTrue();
    }

    @Test
    void 인증없는_이메일설정은_401이다() throws Exception {
        mockMvc.perform(put(EMAIL_URL)
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"anon@naver.com\"}"))
            .andExpect(status().isUnauthorized());
    }

    /** 잔액 행 없이 활성 회원을 커밋 생성한다(이메일 경로는 잔액 미참조). email null 이면 미설정 계정. */
    private User createUser(String loginId, String email) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(loginId).build();
        if (email != null) {
            user.assignEmail(email);
        }
        userRepository.save(user); // 비-tx 컨텍스트 → 즉시 커밋
        createdUserIds.add(user.getId());
        return user;
    }
}
