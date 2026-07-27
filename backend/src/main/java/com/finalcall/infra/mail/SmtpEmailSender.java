package com.finalcall.infra.mail;

import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/**
 * SMTP 실발송 구현체(EPIC-EMAIL-VERIFY B4, spec §6.3·§6.2) — dev/prod. <b>템플릿·인증을 모르는 범용 발송기</b>로,
 * 완성된 제목·본문만 받아 전송한다(문구 책임은 mail feature 템플릿으로 이관, spec §6.4).
 *
 * <p>{@code email.verify.sender-enabled=true}일 때만 활성({@code havingValue="true"}). 이 조건 덕에 local(플래그
 * false·크리덴셜 없음)에선 빈 자체가 생성되지 않아, {@code spring.mail.host} 부재로 {@code JavaMailSender} 오토컨피그가
 * 빈을 만들지 않아도 부팅이 깨지지 않는다({@link JavaMailSender} 주입은 플래그 true 프로파일에서만 요구).
 *
 * <p><b>HTML 지원</b>: {@code html} 파라미터 대비 {@link MimeMessage} + {@link MimeMessageHelper} 로 발송한다
 * ({@code helper.setText(body, html)}).
 *
 * <p><b>실패 전파</b>(spec §4.1): {@link JavaMailSender#send}가 던지는 {@code MailException}과, 메시지 조립 중의
 * {@link MessagingException}(런타임으로 감쌈)은 삼키지 않고 그대로 전파한다 — {@code verification-request} 경로만
 * 실패하고 가입·로그인엔 영향이 없다.
 */
@Component
@ConditionalOnProperty(name = "email.verify.sender-enabled", havingValue = "true")
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final String from;

    /**
     * @param mailSender 오토컨피그({@code MailSenderAutoConfiguration})가 조립한 {@link JavaMailSender}
     * @param from       발신 주소({@code spring.mail.username}) — 네이버 SMTP는 발신자를 인증 계정으로 강제한다
     */
    public SmtpEmailSender(JavaMailSender mailSender, @Value("${spring.mail.username:}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void send(String toEmail, String subject, String body, boolean html) {
        MimeMessage message = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(message, StandardCharsets.UTF_8.name());
            if (StringUtils.hasText(from)) {
                helper.setFrom(from);
            }
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, html);
        } catch (MessagingException e) {
            // 인프라 중립(도메인 예외 금지) 런타임으로 감싸 전파 — verification-request 만 실패(spec §4.1)
            throw new IllegalStateException("이메일 메시지 조립 실패", e);
        }
        mailSender.send(message); // MailException 은 전파(spec §4.1)
    }
}
