package com.finalcall.domain.member.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.EmailErrorCode;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.mail.entity.EmailTemplateKey;
import com.finalcall.domain.mail.service.EmailTemplateService;
import com.finalcall.domain.mail.service.RenderedEmail;
import com.finalcall.domain.member.config.EmailVerifyProperties;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.infra.mail.EmailSender;
import com.finalcall.infra.security.EmailVerificationCodeStore;
import com.finalcall.infra.security.EmailVerificationCodeStore.VerifyOutcome;

/**
 * {@link EmailVerificationService} 단위 테스트 — 스프링 컨텍스트 없이 협력자 모의(가장 빠른 계층).
 *
 * <p>SecurityContext 주체(userId) 기준으로 set-email 정규화·동일값 no-op·변경 시 clear·UK 위반(EMAIL_007),
 * verification-request 가드(EMAIL_006/005/004)·정상 render+send 조립, verify 결과 매핑(EMAIL_001/002/003·SUCCESS)을
 * 고정한다. 정책값은 실제 {@link EmailVerifyProperties}(ttl 600s → expiryMinutes 10)로 주입한다.
 */
@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

    private static final String EMAIL = "user@naver.com";

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailVerificationCodeStore codeStore;

    @Mock
    private EmailTemplateService emailTemplateService;

    @Mock
    private EmailSender emailSender;

    private final EmailVerifyProperties properties = new EmailVerifyProperties(6, 600, 60, 5);

    private EmailVerificationService service;

    @BeforeEach
    void setUp() {
        service = new EmailVerificationService(
            userRepository, codeStore, emailTemplateService, emailSender, properties);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    // ---------------- set-email ----------------

    @Test
    void 이메일_설정은_정규화후_저장하고_pending을_삭제한다() {
        authenticateAs("1");
        User user = userOf(1L, null, false);
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));

        User result = service.setEmail("  User@Naver.COM ");

        assertThat(result.getEmail()).isEqualTo(EMAIL); // trim + lowercase
        assertThat(result.isEmailVerified()).isFalse();
        verify(userRepository).flush(); // 커밋 전 UK 확정
        verify(codeStore).clear("1"); // TOCTOU 주 방어(변경 시 pending 폐기)
    }

    @Test
    void 동일_이메일_재설정은_noop이라_인증을_풀지않고_clear하지않는다() {
        authenticateAs("1");
        User user = userOf(1L, EMAIL, true); // 이미 인증된 이메일
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));

        User result = service.setEmail("USER@naver.com"); // 정규화하면 동일

        assertThat(result.isEmailVerified()).isTrue(); // 인증 불변
        verify(userRepository, never()).flush();
        verify(codeStore, never()).clear(any());
    }

    @Test
    void 다른_이메일로_변경하면_emailVerified가_false로_초기화되고_clear한다() {
        authenticateAs("1");
        User user = userOf(1L, "old@naver.com", true);
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));

        User result = service.setEmail("new@naver.com");

        assertThat(result.getEmail()).isEqualTo("new@naver.com");
        assertThat(result.isEmailVerified()).isFalse(); // 재초기화
        verify(codeStore).clear("1");
    }

    @Test
    void 이메일_UK위반이_flush에서_터지면_EMAIL_007로_매핑하고_clear하지않는다() {
        authenticateAs("1");
        User user = userOf(1L, null, false);
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));
        doThrow(new DataIntegrityViolationException(
            "Duplicate entry 'dup@naver.com' for key 'uk_user_email_active'"))
            .when(userRepository).flush();

        assertThatThrownBy(() -> service.setEmail("dup@naver.com"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_DUPLICATE);

        verify(codeStore, never()).clear(any()); // 위반 시 pending 보존(flush 후 clear 순서)
    }

    // ---------------- verification-request ----------------

    @Test
    void 이메일_미설정이면_발송요청은_EMAIL_006() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, null, false)));

        assertThatThrownBy(() -> service.requestVerification())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_NOT_SET);
        verify(codeStore, never()).issue(any(), any());
    }

    @Test
    void 이미_인증됐으면_발송요청은_EMAIL_005() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, EMAIL, true)));

        assertThatThrownBy(() -> service.requestVerification())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_ALREADY_VERIFIED);
        verify(codeStore, never()).issue(any(), any());
    }

    @Test
    void 쿨다운_내면_발송요청은_EMAIL_004이고_발송하지않는다() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, EMAIL, false)));
        when(codeStore.issue("1", EMAIL)).thenReturn(Optional.empty()); // 쿨다운

        assertThatThrownBy(() -> service.requestVerification())
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_RESEND_COOLDOWN);
        verify(emailTemplateService, never()).render(any(), any());
        verify(emailSender, never()).send(any(), any(), any(), anyBoolean());
    }

    @Test
    void 정상_발송요청은_코드를_렌더해_발송한다() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, EMAIL, false)));
        when(codeStore.issue("1", EMAIL)).thenReturn(Optional.of("123456"));
        when(emailTemplateService.render(any(), any())).thenReturn(new RenderedEmail("제목", "본문", false));

        service.requestVerification();

        // expiryMinutes = ttlSeconds(600)/60 = 10, 코드는 발급값 그대로 렌더 인자로만 주입.
        verify(emailTemplateService).render(
            eq(EmailTemplateKey.EMAIL_VERIFICATION), eq(Map.of("code", "123456", "expiryMinutes", 10L)));
        verify(emailSender).send(EMAIL, "제목", "본문", false);
    }

    // ---------------- verify ----------------

    @Test
    void 이미_인증됐으면_verify는_EMAIL_005이고_저장소검증을_하지않는다() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, EMAIL, true)));

        assertThatThrownBy(() -> service.verify("123456"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_ALREADY_VERIFIED);
        verify(codeStore, never()).verify(any(), any(), any());
    }

    @Test
    void 이메일_미설정이면_verify는_pending없음으로_EMAIL_002() {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, null, false)));

        assertThatThrownBy(() -> service.verify("123456"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_CODE_EXPIRED_OR_ABSENT);
        verify(codeStore, never()).verify(any(), any(), any()); // null 이메일 저장소 전달 방지 사전 가드
    }

    @Test
    void verify_성공이면_조건부UPDATE로_인증을_반영한다() {
        authenticateAs("1");
        User user = userOf(1L, EMAIL, false);
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));
        when(codeStore.verify("1", "123456", EMAIL)).thenReturn(VerifyOutcome.SUCCESS);
        when(userRepository.markEmailVerified(1L, EMAIL)).thenReturn(1); // 이메일 일치 → 1행

        User result = service.verify("123456");

        assertThat(result.isEmailVerified()).isTrue();
        // blind save 가 아니라 검증한 이메일 조건의 원자 UPDATE 를 호출한다(M-1 lost update 차단).
        verify(userRepository).markEmailVerified(1L, EMAIL);
    }

    @Test
    void verify_성공후_이메일이_바뀌어_영향0이면_EMAIL_002이고_인증반영안됨() {
        authenticateAs("1");
        User user = userOf(1L, EMAIL, false);
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(user));
        when(codeStore.verify("1", "123456", EMAIL)).thenReturn(VerifyOutcome.SUCCESS);
        // 검증~커밋 사이 setEmail 경쟁으로 이메일이 바뀜 → 조건부 UPDATE 영향 0 → 구 이메일을 verified 로 확정하지 않음.
        when(userRepository.markEmailVerified(1L, EMAIL)).thenReturn(0);

        assertThatThrownBy(() -> service.verify("123456"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(EmailErrorCode.EMAIL_CODE_EXPIRED_OR_ABSENT);
    }

    @Test
    void verify_불일치는_EMAIL_001이고_저장하지않는다() {
        assertVerifyMaps(VerifyOutcome.MISMATCH, EmailErrorCode.EMAIL_CODE_MISMATCH);
    }

    @Test
    void verify_만료는_EMAIL_002이고_저장하지않는다() {
        assertVerifyMaps(VerifyOutcome.EXPIRED, EmailErrorCode.EMAIL_CODE_EXPIRED_OR_ABSENT);
    }

    @Test
    void verify_시도초과는_EMAIL_003이고_저장하지않는다() {
        assertVerifyMaps(VerifyOutcome.ATTEMPTS_EXCEEDED, EmailErrorCode.EMAIL_VERIFY_ATTEMPTS_EXCEEDED);
    }

    private void assertVerifyMaps(VerifyOutcome outcome, EmailErrorCode expected) {
        authenticateAs("1");
        when(userRepository.findByIdAndIsDeletedFalse(1L)).thenReturn(Optional.of(userOf(1L, EMAIL, false)));
        when(codeStore.verify("1", "123456", EMAIL)).thenReturn(outcome);

        assertThatThrownBy(() -> service.verify("123456"))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> errorCode((BusinessException)e))
            .isEqualTo(expected);
        verify(userRepository, never()).markEmailVerified(any(), any());
    }

    // ---------------- helpers ----------------

    private void authenticateAs(String userId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(userId, null, Collections.emptyList()));
    }

    private ErrorCode errorCode(BusinessException ex) {
        return ex.getErrorCode();
    }

    /** PK(id)·이메일·인증상태가 세팅된 활성 User 픽스처. email null 이면 미설정. */
    private User userOf(long id, String email, boolean verified) {
        User user = User.builder().loginId("u" + id).passwordHash("hash").nickname("n" + id).build();
        ReflectionTestUtils.setField(user, "id", id);
        if (email != null) {
            user.assignEmail(email); // emailVerified=false
            if (verified) {
                user.markEmailVerified();
            }
        }
        return user;
    }
}
