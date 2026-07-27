package com.finalcall.domain.mail.service;

/**
 * 렌더 결과 계산 VO(mail feature) — 템플릿 조회 + 변수 치환의 산출물(email-template-spec §5.3).
 *
 * <p><b>영속 아님·직렬화 계약 아님</b>이라 §9.10에 따라 {@code domain/mail/service/}에 record로 잔류한다
 * (도메인 명사, 서비스 접미사 없음). 소비자(member 서비스)는 이 값을 {@code EmailSender.send(...)}로 넘길 뿐
 * 어디에도 저장하지 않는다.
 *
 * <p>보안 경계(spec §6): {@code subject}·{@code body}엔 치환된 실제 코드가 담기지만 전송 직전 값(transient)이다
 * — 저장·로그 금지(local {@code LoggingEmailSender} 로그만 예외).
 *
 * @param subject 치환 완료된 제목
 * @param body    치환 완료된 본문
 * @param html    본문이 HTML인지(템플릿 {@code content_type}에서 파생) — {@code EmailSender} 발송 형식 결정
 */
public record RenderedEmail(String subject, String body, boolean html) {
}
