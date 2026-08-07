package com.finalcall.domain.board.dto;

import java.time.Instant;

import com.finalcall.domain.board.entity.Comment;

import lombok.Builder;

/**
 * 답글 목록 항목 응답(EPIC-COMMENT-V2, api §6.3 {@code GET /posts/{postPublicId}/comments/{commentPublicId}/replies}).
 * 계약 형상 = {@code CommentResponse} 코어 + {@code mentionedNickname} =
 * {@code { commentPublicId, authorNickname, content, createdAt, updatedAt, editable, likeCount, dislikeCount,
 * myReaction, deleted, mentionedNickname }}.
 *
 * <p>답글은 {@code replyCount} 를 싣지 않는다(1단계 — 답글의 답글은 물리적으로 같은 루트에 붙는다). {@code mentionedNickname}
 * 은 답글의 답글일 때 @멘션 대상 닉 스냅샷, 직접 답글이면 {@code null}(board-spec §13.1). 답글 목록은 활성만 인출하므로
 * ({@code is_deleted=false} 고정) tombstone 이 없다 — {@code deleted} 는 항상 false 다(형상 일관성 위해 필드는 유지). 답글 삭제는
 * 완전 배제(§13.4). {@code myReaction} 은 FC-207 에서 배선만 열어두고 항상 {@code null}(FC-208 채움).
 */
@Builder
public record ReplyResponse(
    String commentPublicId,
    String authorNickname,
    String content,
    Instant createdAt,
    Instant updatedAt,
    boolean editable,
    boolean ownedByMe,
    int likeCount,
    int dislikeCount,
    String myReaction,
    boolean deleted,
    String mentionedNickname) {

    /**
     * 답글 항목을 조립한다. 답글은 tombstone 대상이 아니므로 마스킹 분기가 없다(활성만 인출).
     *
     * @param editable   요청 주체가 작성자이거나 관리자인지(프론트 버튼 제어)
     * @param myReaction 뷰어의 반응(LIKE|DISLIKE|null) — FC-207 은 항상 null, FC-208 이 채운다
     */
    public static ReplyResponse from(
        Comment comment, boolean editable, boolean ownedByMe, String myReaction) {
        return ReplyResponse.builder()
            .commentPublicId(comment.getPublicId())
            .authorNickname(comment.getAuthorNickname())
            .content(comment.getContent())
            .createdAt(comment.getCreatedAt())
            .updatedAt(comment.getUpdatedAt())
            .editable(editable)
            .ownedByMe(ownedByMe)
            .likeCount(comment.getLikeCount())
            .dislikeCount(comment.getDislikeCount())
            .myReaction(myReaction)
            .deleted(false)
            .mentionedNickname(comment.getMentionedNickname())
            .build();
    }
}
