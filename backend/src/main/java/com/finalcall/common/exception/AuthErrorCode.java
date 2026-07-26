package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 인증(auth) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code AUTH_{3자리}}.
 *
 * <p>api-contract §2·§5 정합. 여기서는 auth 기반(006) 범위인 가입·로그인·refresh 코드까지 정의한다.
 * 관리자 권한 부족({@code AUTH_005})은 관리자 API 도입 단계에서 추가한다.
 */
@Getter
@RequiredArgsConstructor
public enum AuthErrorCode implements ErrorCode {

    AUTH_DUPLICATE_LOGIN_ID("AUTH_001", HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디입니다."),
    AUTH_DUPLICATE_NICKNAME("AUTH_002", HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    AUTH_INVALID_CREDENTIALS("AUTH_003", HttpStatus.UNAUTHORIZED, "로그인 아이디 또는 비밀번호가 올바르지 않습니다."),
    AUTH_INVALID_REFRESH_TOKEN("AUTH_004", HttpStatus.UNAUTHORIZED, "만료되었거나 유효하지 않은 리프레시 토큰입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
