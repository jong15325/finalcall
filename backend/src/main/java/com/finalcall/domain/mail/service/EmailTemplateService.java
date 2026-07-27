package com.finalcall.domain.mail.service;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.MailErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;
import com.finalcall.domain.mail.entity.EmailTemplate;
import com.finalcall.domain.mail.entity.EmailTemplateKey;
import com.finalcall.domain.mail.entity.MailContentType;
import com.finalcall.domain.mail.repository.EmailTemplateRepository;

import lombok.RequiredArgsConstructor;

/**
 * 메일 템플릿 렌더링 서비스(mail feature) — 템플릿 조회 + 변수 치환 → 제목·본문 산출(email-template-spec §5).
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)} 기본(DB 조회, CLAUDE.md §5). 렌더링은 순수 문자열
 * 치환이라 무거운 템플릿 엔진(Thymeleaf 등)을 도입하지 않는다(과설계 회피, spec §5.1) — {@code {{name}}}
 * 이중 중괄호 placeholder를 자체 치환한다.
 *
 * <p>검증(fail-fast, spec §5.2): (1) {@link EmailTemplateKey}가 선언한 필수 변수 누락, (2) 치환 후 잔여
 * {@code {{...}}}(템플릿↔변수 계약 드리프트·오타) → 둘 다 {@code MAIL_002}. 여분 변수는 무시(관대). 이들은
 * <b>서버 측 설정/시드 결함</b>이라 500 계열이지 클라이언트 입력 오류가 아니다.
 *
 * <p>보안 경계(spec §6): render 인자의 실제 코드 값과 {@link RenderedEmail}은 저장·로그하지 않는다.
 * {@code @ServiceLog}는 메서드명·소요시간만 남기고 인자를 덤프하지 않아 코드 값이 로그로 새지 않는다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EmailTemplateService {

    /** {@code {{name}}} placeholder — 이름 캡처. 양쪽 공백 허용({@code {{ code }}}도 인식). */
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*(\\w+)\\s*\\}\\}");

    private final EmailTemplateRepository emailTemplateRepository;

    /**
     * 템플릿을 조회해 변수를 치환한 제목·본문을 산출한다.
     *
     * @param key       템플릿 자연키(필수 변수 계약을 선언)
     * @param variables 치환 변수 맵(문자열화해 대입). 필수 변수는 모두 포함해야 하고, 여분은 무시된다
     * @return 치환 완료된 {@link RenderedEmail}(transient — 저장·로그 금지)
     * @throws BusinessException 템플릿 없음/비활성({@code MAIL_001}), 필수 변수 누락·잔여 placeholder({@code MAIL_002})
     */
    @ServiceLog
    public RenderedEmail render(EmailTemplateKey key, Map<String, Object> variables) {
        // 1) 조회 — 없거나 비활성이면 동일하게 MAIL_001(spec §5.4). 활성 판정은 서비스 책임(FC-134 (g)).
        EmailTemplate template = emailTemplateRepository.findByTemplateKey(key)
            .filter(EmailTemplate::isActive)
            .orElseThrow(() -> new BusinessException(MailErrorCode.MAIL_TEMPLATE_NOT_FOUND));

        // 2) 필수 변수 누락 검증 — 하나라도 없으면(또는 null) MAIL_002. "{{code}}"가 그대로 발송되는 사고 방지.
        for (String required : key.requiredVariables()) {
            Preconditions.validate(
                variables.get(required) != null, MailErrorCode.MAIL_INVALID_VARIABLES);
        }

        // 3) 치환 — 제목·본문 양쪽. 미제공 변수의 placeholder는 남겨 두고 4)에서 잡는다.
        String subject = substitute(template.getSubject(), variables);
        String body = substitute(template.getBody(), variables);

        // 4) 잔여 placeholder 검증 — 치환 후 {{...}}가 남으면 계약 드리프트·오타 신호 → MAIL_002.
        Preconditions.validate(!PLACEHOLDER.matcher(subject).find(), MailErrorCode.MAIL_INVALID_VARIABLES);
        Preconditions.validate(!PLACEHOLDER.matcher(body).find(), MailErrorCode.MAIL_INVALID_VARIABLES);

        boolean html = template.getContentType() == MailContentType.HTML;
        return new RenderedEmail(subject, body, html);
    }

    /**
     * {@code {{name}}} placeholder를 변수 값(문자열화)으로 치환한다. 제공되지 않은 이름은 원문 그대로 남긴다
     * (잔여 검증 4)이 오타·드리프트로 판정).
     */
    private String substitute(String template, Map<String, Object> variables) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            Object value = variables.get(matcher.group(1));
            String replacement = value != null ? value.toString() : matcher.group(0);
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }
}
