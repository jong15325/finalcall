package com.finalcall.domain.mail.entity;

/**
 * 메일 본문 형식(mail feature). DB {@code email_template.content_type}(VARCHAR(10)) 매핑용 자연 enum.
 *
 * <p>인증 메일은 {@code TEXT}면 충분하나, 향후 '안내' 재사용 시 {@code HTML}이 필요하다(spec §3·§4.4).
 * 저장은 {@code @Enumerated(EnumType.STRING)} 으로 이름을 저장한다. HTML 여부 파생 등 렌더링 편의는
 * 렌더링 서비스(FC-135) 소관이라 여기선 최소 정의만 둔다.
 */
public enum MailContentType {

    TEXT,
    HTML
}
