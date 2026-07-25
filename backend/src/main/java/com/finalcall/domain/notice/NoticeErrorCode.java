package com.finalcall.domain.notice;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 공지 도메인 에러 코드(Stage D) — 공통 {@link ErrorCode} 인터페이스의 첫 도메인 구현체(본보기).
 * 네이밍은 {@code NOTICE_{3자리}}.
 */
@Getter
@RequiredArgsConstructor
public enum NoticeErrorCode implements ErrorCode {

    NOTICE_NOT_FOUND("NOTICE_001", HttpStatus.NOT_FOUND, "공지사항을 찾을 수 없습니다."),
    NOTICE_ALREADY_DELETED("NOTICE_002", HttpStatus.CONFLICT, "이미 삭제된 공지사항입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
