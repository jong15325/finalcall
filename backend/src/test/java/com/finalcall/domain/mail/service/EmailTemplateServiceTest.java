package com.finalcall.domain.mail.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.MailErrorCode;
import com.finalcall.domain.mail.entity.EmailTemplate;
import com.finalcall.domain.mail.entity.EmailTemplateKey;
import com.finalcall.domain.mail.entity.MailContentType;
import com.finalcall.domain.mail.repository.EmailTemplateRepository;

/**
 * {@link EmailTemplateService} 단위 테스트 — 리포지토리를 모의해 순수 렌더 로직만 검증(DB 불요).
 *
 * <p>정상 치환·필수변수 누락(MAIL_002)·잔여 placeholder(MAIL_002)·템플릿 없음(MAIL_001)·비활성(MAIL_001)·
 * 여분변수 무시를 검증한다(email-template-spec §5).
 */
@ExtendWith(MockitoExtension.class)
class EmailTemplateServiceTest {

    @Mock
    private EmailTemplateRepository emailTemplateRepository;

    @InjectMocks
    private EmailTemplateService emailTemplateService;

    @Test
    void 정상적으로_필수변수를_치환하고_TEXT면_html은_false다() {
        givenTemplate(template(
            "[장터] 이메일 인증 코드",
            "인증 코드: {{code}}\n{{expiryMinutes}}분 안에 입력해 주세요.",
            MailContentType.TEXT,
            true));

        RenderedEmail rendered = emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION,
            Map.of("code", "482913", "expiryMinutes", 5));

        assertThat(rendered.subject()).isEqualTo("[장터] 이메일 인증 코드");
        assertThat(rendered.body()).isEqualTo("인증 코드: 482913\n5분 안에 입력해 주세요.");
        assertThat(rendered.html()).isFalse();
    }

    @Test
    void HTML_템플릿이면_html은_true다() {
        givenTemplate(template(
            "{{code}}", "<b>{{code}}</b> {{expiryMinutes}}분", MailContentType.HTML, true));

        RenderedEmail rendered = emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION,
            Map.of("code", "111111", "expiryMinutes", 3));

        assertThat(rendered.html()).isTrue();
        assertThat(rendered.body()).isEqualTo("<b>111111</b> 3분");
    }

    @Test
    void 필수변수가_누락되면_MAIL_002() {
        givenTemplate(template(
            "제목", "인증 코드: {{code}}\n{{expiryMinutes}}분", MailContentType.TEXT, true));

        // expiryMinutes 누락
        assertThatThrownBy(() -> emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION, Map.of("code", "482913")))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MailErrorCode.MAIL_INVALID_VARIABLES);
    }

    @Test
    void 치환후_잔여_placeholder가_남으면_MAIL_002() {
        // 템플릿이 계약에 없는 {{unknown}}을 품음(오타·드리프트) → 필수변수는 다 있으나 치환 후 잔여.
        givenTemplate(template(
            "제목", "인증 코드: {{code}} {{expiryMinutes}}분 {{unknown}}", MailContentType.TEXT, true));

        assertThatThrownBy(() -> emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION, Map.of("code", "482913", "expiryMinutes", 5)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MailErrorCode.MAIL_INVALID_VARIABLES);
    }

    @Test
    void 템플릿이_없으면_MAIL_001() {
        when(emailTemplateRepository.findByTemplateKey(EmailTemplateKey.EMAIL_VERIFICATION))
            .thenReturn(Optional.empty());

        assertThatThrownBy(() -> emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION, Map.of("code", "482913", "expiryMinutes", 5)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MailErrorCode.MAIL_TEMPLATE_NOT_FOUND);
    }

    @Test
    void 비활성_템플릿이면_없음과_동일하게_MAIL_001() {
        givenTemplate(template(
            "제목", "{{code}} {{expiryMinutes}}", MailContentType.TEXT, false));

        assertThatThrownBy(() -> emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION, Map.of("code", "482913", "expiryMinutes", 5)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException)e).getErrorCode())
            .isEqualTo(MailErrorCode.MAIL_TEMPLATE_NOT_FOUND);
    }

    @Test
    void 여분_변수는_무시하고_정상_렌더한다() {
        givenTemplate(template(
            "제목", "인증 코드: {{code}} {{expiryMinutes}}분", MailContentType.TEXT, true));

        RenderedEmail rendered = emailTemplateService.render(
            EmailTemplateKey.EMAIL_VERIFICATION,
            Map.of("code", "482913", "expiryMinutes", 5, "extra", "무시됨"));

        assertThat(rendered.body()).isEqualTo("인증 코드: 482913 5분");
    }

    private void givenTemplate(EmailTemplate template) {
        when(emailTemplateRepository.findByTemplateKey(EmailTemplateKey.EMAIL_VERIFICATION))
            .thenReturn(Optional.of(template));
    }

    private EmailTemplate template(String subject, String body, MailContentType contentType, boolean active) {
        return EmailTemplate.builder()
            .templateKey(EmailTemplateKey.EMAIL_VERIFICATION)
            .subject(subject)
            .body(body)
            .contentType(contentType)
            .description("테스트 템플릿")
            .isActive(active)
            .build();
    }
}
