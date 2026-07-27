package com.finalcall.infra.mail;

/**
 * 이메일 발송 추상화(EPIC-EMAIL-VERIFY B4 / EPIC-EMAIL-TEMPLATE 연동, spec §6.3~§6.4) — <b>템플릿·인증을 모르는
 * 범용 발송기</b>.
 *
 * <p><b>책임 경계</b>: 제목·본문을 스스로 만들지 않는다. 문구는 mail feature의 DB 템플릿({@code EMAIL_VERIFICATION})을
 * 렌더링한 결과이고, 발송 조립(render→send)은 소비 도메인 서비스(FC-132)가 한다. 이 발송기는 완성된 제목·본문을
 * 원시 문자열로 받아 전송만 한다.
 *
 * <p><b>레이어 규율(infra→domain 금지)</b>: 도메인 타입을 참조하지 않고 원시 문자열({@code toEmail}·{@code subject}·
 * {@code body})과 {@code boolean html}만 주고받는다.
 *
 * <p><b>프로파일 거동</b>({@code email.verify.sender-enabled} 플래그로 구현체 택일):
 * <ul>
 *   <li>{@link LoggingEmailSender} — 기본(local, 플래그 미설정·false). SMTP 미호출·제목/본문 로그.</li>
 *   <li>{@link SmtpEmailSender} — dev/prod(플래그 true). {@code JavaMailSender} 실발송.</li>
 * </ul>
 */
public interface EmailSender {

    /**
     * 완성된 제목·본문을 대상 이메일로 발송한다.
     *
     * <p><b>실패 전파 계약</b>(spec §4.1·§6.3): 발송 실패(SMTP 예외 등)는 <b>삼키지 않고 전파</b>한다. 이 예외는
     * {@code verification-request} 경로만 실패시키며 가입·로그인엔 영향이 없다(자동발송 미채택 근거). 전파하는 예외는
     * 인프라 중립(도메인 예외 금지) — 표준 {@code MailException}/런타임 예외다.
     *
     * @param toEmail 정규화(lowercase+trim)된 대상 이메일 — 정규화는 호출 측 책임
     * @param subject 발송할 제목(렌더링 완료)
     * @param body    발송할 본문(렌더링 완료)
     * @param html    {@code true}면 본문을 HTML 로, {@code false}면 평문으로 전송
     */
    void send(String toEmail, String subject, String body, boolean html);
}
