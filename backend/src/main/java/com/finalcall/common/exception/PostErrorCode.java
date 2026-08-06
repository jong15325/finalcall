package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게시글 도메인 에러 코드(EPIC-BOARD, FC-198) — 공통 {@link ErrorCode} 구현체. 네이밍 {@code POST_{3자리}}.
 * 배치는 V2 중앙화 규약대로 {@code com.finalcall.common.exception}(feature 루트 아님). 코드 표 정본 = api-contract §6.2·§4.
 *
 * <p>게시판 소유 에러({@code BOARD_002} 쓰기 정책 위반·{@code BOARD_003} 댓글 비허용)는 {@link BoardErrorCode}가
 * 이미 소유하므로 여기에 중복 정의하지 않는다 — 게시글은 게시글 고유 흐름(미존재·소유권)만 담는다.
 *
 * <ul>
 *   <li>{@code POST_001} — 게시글 없음·삭제됨(404). 열거 완화(SEC-007): 글 존재는 공개 목록에 이미 노출되므로
 *       미존재 404 와 타인 글 수정 403({@code POST_002})을 구분해도 열거 이득이 없다(board-spec I-4).
 *   <li>{@code POST_002} — 작성자 아님(403). 수정·삭제 IDOR 차단(작성자 본인 OR {@code ROLE_ADMIN}만, board-spec I-2).
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum PostErrorCode implements ErrorCode {

    POST_NOT_FOUND("POST_001", HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다."),
    POST_NOT_OWNER("POST_002", HttpStatus.FORBIDDEN, "게시글을 수정·삭제할 권한이 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
