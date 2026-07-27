package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 메일 템플릿(mail) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code MAIL_{3자리}}.
 *
 * <p>둘 다 <b>서버 측 설정/시드 결함</b>(개발자 책임)이지 클라이언트 입력 오류가 아니므로 500 계열이다
 * (email-template-spec §5.2·§5.4). 클라이언트가 행동으로 해소할 수 없어 api-contract §5·프론트
 * {@code errorCodes.ts}에는 <b>미등재</b>한다(게이트2 사용자 승인, 2026-07-27). {@code GlobalExceptionHandler}
 * 가 일반 500으로 처리한다.
 */
@Getter
@RequiredArgsConstructor
public enum MailErrorCode implements ErrorCode {

    /** 템플릿 없음/비활성({@code template_key} 미스 또는 {@code is_active=0}) — 둘을 동일 코드로 통일(spec §5.4). */
    MAIL_TEMPLATE_NOT_FOUND("MAIL_001", HttpStatus.INTERNAL_SERVER_ERROR, "메일 템플릿을 찾을 수 없습니다"),

    /** 필수 변수 누락 또는 치환 후 잔여 placeholder(템플릿↔변수 계약 드리프트, spec §5.2). */
    MAIL_INVALID_VARIABLES("MAIL_002", HttpStatus.INTERNAL_SERVER_ERROR, "메일 템플릿 변수가 유효하지 않습니다");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
