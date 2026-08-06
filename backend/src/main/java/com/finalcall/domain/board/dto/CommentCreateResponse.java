package com.finalcall.domain.board.dto;

import java.time.Instant;

import com.finalcall.domain.board.entity.Comment;

/**
 * 댓글 작성 응답(EPIC-BOARD, api §6.3 {@code POST /posts/{postPublicId}/comments} 201). 계약 형상
 * {@code { commentPublicId, createdAt }}. 생성된 댓글의 외부 식별자·작성 시각만 반환한다.
 */
public record CommentCreateResponse(String commentPublicId, Instant createdAt) {

    public static CommentCreateResponse from(Comment comment) {
        return new CommentCreateResponse(comment.getPublicId(), comment.getCreatedAt());
    }
}
