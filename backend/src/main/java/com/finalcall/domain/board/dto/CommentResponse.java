package com.finalcall.domain.board.dto;

import java.time.Instant;

import com.finalcall.domain.board.entity.Comment;

import lombok.Builder;

/**
 * 댓글 목록 항목 응답(EPIC-BOARD, api §6.3 {@code GET /posts/{postPublicId}/comments}). Response = record + {@code @Builder}
 * + static from. 계약 형상 {@code { commentPublicId, authorNickname, content, createdAt, updatedAt, editable }}.
 *
 * <p>{@code editable} 은 요청 주체가 작성자이거나 관리자면 true(비로그인·타인 false) — 프론트 수정/삭제 버튼 노출 제어용이며
 * 인가 권위는 서버다(§1.2). {@code authorNickname} 은 작성 시점 스냅샷(R1 닉 변경·탈퇴 대비).
 */
@Builder
public record CommentResponse(
    String commentPublicId,
    String authorNickname,
    String content,
    Instant createdAt,
    Instant updatedAt,
    boolean editable) {

    /**
     * 댓글 항목을 조립한다. {@code editable} 은 서비스가 주체·관리자 여부로 판정해 넘긴다(비로그인 목록 조회는 false).
     *
     * @param editable 요청 주체가 작성자이거나 관리자인지(프론트 버튼 제어)
     */
    public static CommentResponse from(Comment comment, boolean editable) {
        return CommentResponse.builder()
            .commentPublicId(comment.getPublicId())
            .authorNickname(comment.getAuthorNickname())
            .content(comment.getContent())
            .createdAt(comment.getCreatedAt())
            .updatedAt(comment.getUpdatedAt())
            .editable(editable)
            .build();
    }
}
