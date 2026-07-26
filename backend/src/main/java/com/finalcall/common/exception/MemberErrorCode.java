package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 회원(member) 도메인 에러 코드 — 공통 {@link ErrorCode} 인터페이스 구현. 네이밍은 {@code MEMBER_{3자리}}.
 *
 * <p>api-contract §5 정합. 닉네임 중복({@code MEMBER_001})은 프로필 수정 맥락의 코드로,
 * 가입 시 닉네임 중복({@code AUTH_002})과 동일한 UK 위반이나 별개 코드로 구분한다.
 */
@Getter
@RequiredArgsConstructor
public enum MemberErrorCode implements ErrorCode {

    MEMBER_DUPLICATE_NICKNAME("MEMBER_001", HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    MEMBER_WITHDRAW_BLOCKED_BY_ACTIVE_TRADE("MEMBER_002", HttpStatus.CONFLICT, "진행 중인 거래가 있어 탈퇴할 수 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
