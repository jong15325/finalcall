package com.finalcall.infra.mail;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * 발송 스킵 + 제목/본문 로그 구현체(EPIC-EMAIL-VERIFY B4, spec §6.3) — <b>기본(local)</b>.
 *
 * <p>{@code email.verify.sender-enabled} 미설정·{@code false}일 때 활성({@code matchIfMissing=true}). yml에 정책 블록
 * (FC-130)이 아직 없어도 부팅되도록 기본값을 이 조건에 둔다 — SMTP 크리덴셜·{@code JavaMailSender} 빈 없이 인증 흐름을
 * 개발자가 테스트할 수 있게, 렌더링된 제목·본문을 로그로 출력한다(본문에 코드가 담기지만 local 한정, spec §6.4).
 *
 * <p><b>노출 최소화</b>: 이메일 주소는 마스킹해 로그에 남긴다. 이 구현체는 운영 프로파일(플래그 true)에선 비활성이므로
 * 본문(코드 포함)이 운영 로그로 새지 않는다.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "email.verify.sender-enabled", havingValue = "false", matchIfMissing = true)
public class LoggingEmailSender implements EmailSender {

    @Override
    public void send(String toEmail, String subject, String body, boolean html) {
        log.info("[EmailSender:LOG] 발송 스킵(sender-enabled=false) — to={}, html={}, subject={}, body={}",
            mask(toEmail), html, subject, body);
    }

    /** 이메일 로컬파트를 첫 글자만 남기고 마스킹한다(예: {@code a***@naver.com}). null·빈 값은 그대로 둔다. */
    private static String mask(String email) {
        if (email == null || email.isBlank()) {
            return email;
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
