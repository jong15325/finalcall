package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 인증(auth) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code AUTH_{3자리}}.
 *
 * <p>api-contract §2·§5 정합. 가입·로그인·refresh(001~004) + 관리자 권한(005) + 소셜 로그인(006~008)을 정의한다.
 * 소셜 로그인 코드(EPIC-OAUTH, FC-154): {@code AUTH_006} 미지원 provider(400) · {@code AUTH_007} 인가코드 교환
 * 실패(401) · {@code AUTH_008} provider 통신 실패(502).
 */
@Getter
@RequiredArgsConstructor
public enum AuthErrorCode implements ErrorCode {

    AUTH_DUPLICATE_LOGIN_ID("AUTH_001", HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디입니다."),
    AUTH_DUPLICATE_NICKNAME("AUTH_002", HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    AUTH_INVALID_CREDENTIALS("AUTH_003", HttpStatus.UNAUTHORIZED, "로그인 아이디 또는 비밀번호가 올바르지 않습니다."),
    AUTH_INVALID_REFRESH_TOKEN("AUTH_004", HttpStatus.UNAUTHORIZED, "만료되었거나 유효하지 않은 리프레시 토큰입니다."),
    AUTH_FORBIDDEN("AUTH_005", HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    AUTH_UNSUPPORTED_PROVIDER("AUTH_006", HttpStatus.BAD_REQUEST, "지원하지 않는 소셜 로그인 제공자입니다."),
    AUTH_OAUTH_EXCHANGE_FAILED("AUTH_007", HttpStatus.UNAUTHORIZED, "소셜 인가 코드 교환에 실패했습니다."),
    AUTH_OAUTH_PROVIDER_ERROR("AUTH_008", HttpStatus.BAD_GATEWAY, "소셜 로그인 제공자와 통신하지 못했습니다."),
    AUTH_DEMO_UNAVAILABLE("AUTH_009", HttpStatus.SERVICE_UNAVAILABLE, "현재 테스트 계정을 사용할 수 없습니다."),
    AUTH_DEMO_READ_ONLY("AUTH_011", HttpStatus.FORBIDDEN, "체험 계정은 읽기 전용입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
