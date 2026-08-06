package com.finalcall.domain.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 댓글 수정 요청(EPIC-BOARD, api §6.3 {@code PUT /posts/{postPublicId}/comments/{commentPublicId}}). 작성과 동일 스키마·검증.
 *
 * @param content 본문(필수·≤1000)
 */
public record CommentUpdateRequest(
    @NotBlank(message = "내용은 필수입니다.") @Size(max = 1000, message = "내용은 1000자 이하여야 합니다.") String content) {
}
