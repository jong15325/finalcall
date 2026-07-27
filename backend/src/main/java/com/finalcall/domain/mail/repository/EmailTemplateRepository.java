package com.finalcall.domain.mail.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.mail.entity.EmailTemplate;
import com.finalcall.domain.mail.entity.EmailTemplateKey;

/**
 * 메일 템플릿 리포지토리(mail feature). 자연키({@link EmailTemplateKey})로 템플릿을 조회한다.
 *
 * <p>비활성({@code is_active=0}) 필터링은 렌더링 서비스(FC-135) 책임으로 둔다 — 조회는 자연키로만 하고,
 * 활성 여부 판정과 {@code MAIL_001}(없음/비활성) 매핑은 소비자가 수행한다(spec §5.4). "없음"과 "비활성"을
 * 서비스에서 같은 에러코드로 함께 다루기 위함이며, 리포지토리에 조건을 선반영하지 않는다(과설계 회피).
 */
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {

    /** 자연키로 템플릿 조회. 활성 여부 판정은 호출측(FC-135) 책임. */
    Optional<EmailTemplate> findByTemplateKey(EmailTemplateKey templateKey);

    /**
     * OrThrow default 메서드 패턴(CLAUDE.md §5) — 없으면 {@link BusinessException}.
     *
     * <p>{@code MailErrorCode}는 FC-135 소관이라 여기서 참조하지 않는다. {@link ErrorCode}(common 인터페이스)를
     * 파라미터로 받아 호출자(FC-135)가 {@code MAIL_001}을 주입한다(findByIdOrThrow 패턴 동형).
     */
    default EmailTemplate findByKeyOrThrow(EmailTemplateKey templateKey, ErrorCode errorCode) {
        return findByTemplateKey(templateKey).orElseThrow(() -> new BusinessException(errorCode));
    }
}
