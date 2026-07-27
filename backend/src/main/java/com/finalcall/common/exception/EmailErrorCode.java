package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 이메일 인증(email) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code EMAIL_{3자리}}.
 *
 * <p>api-contract §5·email-verify-spec §5 와 1:1 정합. 상태코드 매핑(§5·계약 §1.5): 도메인 규칙 위반
 * (코드 불일치·만료)=422, 남용 억제(재전송 쿨다운·시도 초과)=429, 상태 충돌(이미 인증·미설정·이미 사용 중)=409.
 *
 * <p>{@code EMAIL_002} 는 "코드 없음"과 "만료"를 한 코드로 통일한다 — pending 코드 존재 여부를 응답으로 노출하지
 * 않기 위함(SEC-007 열거 최소화, spec §2.3·§5).
 */
@Getter
@RequiredArgsConstructor
public enum EmailErrorCode implements ErrorCode {

    EMAIL_CODE_MISMATCH("EMAIL_001", HttpStatus.UNPROCESSABLE_ENTITY, "인증 코드가 일치하지 않습니다."),
    EMAIL_CODE_EXPIRED_OR_ABSENT(
        "EMAIL_002", HttpStatus.UNPROCESSABLE_ENTITY, "인증 코드가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요."),
    EMAIL_VERIFY_ATTEMPTS_EXCEEDED(
        "EMAIL_003", HttpStatus.TOO_MANY_REQUESTS, "인증 시도 횟수를 초과했습니다. 코드를 다시 요청해 주세요."),
    EMAIL_RESEND_COOLDOWN("EMAIL_004", HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 인증 코드를 요청해 주세요."),
    EMAIL_ALREADY_VERIFIED("EMAIL_005", HttpStatus.CONFLICT, "이미 인증된 이메일입니다."),
    EMAIL_NOT_SET("EMAIL_006", HttpStatus.CONFLICT, "이메일이 설정되어 있지 않습니다."),
    EMAIL_DUPLICATE("EMAIL_007", HttpStatus.CONFLICT, "이미 사용 중인 이메일입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
