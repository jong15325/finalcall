package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게시판 도메인 에러 코드(EPIC-BOARD) — 공통 {@link ErrorCode} 인터페이스 구현체. 네이밍 {@code BOARD_{3자리}}.
 * 배치는 V2 중앙화 규약대로 {@code com.finalcall.common.exception}(feature 루트 아님).
 *
 * <p>코드 표 정본 = api-contract §5. {@code BOARD_001}은 이번 티켓(FC-197 조회 API)이 사용하고,
 * {@code BOARD_002}(쓰기 정책 위반)·{@code BOARD_003}(댓글 비허용)은 게시판 속성이 결정하는 쓰기·댓글 흐름
 * (FC-198·199)에서 사용한다 — 게시판 소유 에러 카탈로그라 한곳에 정의한다.
 */
@Getter
@RequiredArgsConstructor
public enum BoardErrorCode implements ErrorCode {

    BOARD_NOT_FOUND("BOARD_001", HttpStatus.NOT_FOUND, "게시판을 찾을 수 없습니다."),
    BOARD_WRITE_FORBIDDEN("BOARD_002", HttpStatus.FORBIDDEN, "게시판에 글을 작성할 권한이 없습니다."),
    BOARD_COMMENTS_NOT_ALLOWED("BOARD_003", HttpStatus.UNPROCESSABLE_ENTITY, "댓글을 허용하지 않는 게시판입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
