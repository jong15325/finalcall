package com.finalcall.domain.mail.entity;

import com.finalcall.common.entity.BaseTimeEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 재사용 메일 템플릿 엔티티(mail feature) — 개발자 시드 마스터/설정 테이블(V18 {@code email_template}).
 *
 * <p>컨벤션(CLAUDE.md §5): {@code @NoArgsConstructor(PROTECTED)}·생성자 {@code @Builder}·{@code @Setter} 금지
 * → 상태 변경은 도메인 메서드로만. 마스터 테이블이라 soft delete 없이 {@code isActive} 플래그로 비활성화한다
 * (V6 {@code item_template} 선례, spec §3). 자연키 {@code templateKey}의 유일성은 DB UK
 * ({@code uk_email_template_key})가 강제하므로 엔티티엔 unique 표기를 생략한다(login_id 패턴 동형).
 *
 * <p>보안 경계(spec §6): {@code body}엔 {@code {{code}}} 같은 placeholder만 저장한다. 실제 인증 코드는
 * 절대 영속되지 않고 렌더 시점에 런타임 주입된다.
 */
@Entity
@Getter
@Table(name = "email_template")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmailTemplate extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_key", nullable = false, length = 50)
    private EmailTemplateKey templateKey;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 10)
    private MailContentType contentType;

    @Column(length = 500)
    private String description;

    @Column(name = "is_active", nullable = false)
    private boolean isActive;

    @Builder
    private EmailTemplate(
        EmailTemplateKey templateKey,
        String subject,
        String body,
        MailContentType contentType,
        String description,
        boolean isActive) {
        this.templateKey = templateKey;
        this.subject = subject;
        this.body = body;
        this.contentType = contentType;
        this.description = description;
        this.isActive = isActive;
    }
}
