package com.finalcall.domain.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 댓글 작성 요청(EPIC-BOARD, api §6.3 {@code POST /posts/{postPublicId}/comments}). 형식 검증은 Bean Validation, 한국어 메시지.
 *
 * <p>작성자 필드는 요청에 없다 — 작성자는 SecurityContext 주체로만 취한다(B-009, IDOR 차단). 게시글 귀속은 경로
 * {@code postPublicId} 로 결정한다.
 *
 * @param content 본문(필수·≤1000)
 */
public record CommentCreateRequest(
    @NotBlank(message = "내용은 필수입니다.") @Size(max = 1000, message = "내용은 1000자 이하여야 합니다.") String content) {
}
