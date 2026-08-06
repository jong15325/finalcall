package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 댓글 도메인 에러 코드(EPIC-BOARD, FC-199) — 공통 {@link ErrorCode} 구현체. 네이밍 {@code COMMENT_{3자리}}.
 * 배치는 V2 중앙화 규약대로 {@code com.finalcall.common.exception}(feature 루트 아님). 코드 표 정본 = api-contract §6.3·§5·§4.
 *
 * <p>댓글 흐름의 외부 의존 에러는 각 소유 카탈로그를 재사용한다 — 글 미존재는 {@link PostErrorCode#POST_NOT_FOUND}
 * (POST_001), 댓글 비허용 게시판은 {@link BoardErrorCode#BOARD_COMMENTS_NOT_ALLOWED}(BOARD_003). 여기서는 댓글 고유
 * 흐름(미존재·소유권)만 담는다.
 *
 * <ul>
 *   <li>{@code COMMENT_001} — 댓글 없음·삭제됨(404). 수정·삭제 대상 활성 댓글이 없을 때(board-spec P-2 활성 필터).
 *   <li>{@code COMMENT_002} — 작성자 아님(403). 수정·삭제 IDOR 차단(작성자 본인 OR {@code ROLE_ADMIN}만, board-spec I-2).
 * </ul>
 */
@Getter
@RequiredArgsConstructor
public enum CommentErrorCode implements ErrorCode {

    COMMENT_NOT_FOUND("COMMENT_001", HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다."),
    COMMENT_NOT_OWNER("COMMENT_002", HttpStatus.FORBIDDEN, "댓글을 수정·삭제할 권한이 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
