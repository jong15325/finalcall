package com.finalcall.domain.board.dto;

import java.time.Instant;

import com.finalcall.domain.board.entity.Comment;

import lombok.Builder;

/**
 * 루트 댓글 목록 항목 응답(EPIC-COMMENT-V2, api §6.3 {@code GET /posts/{postPublicId}/comments}). Response = record +
 * {@code @Builder} + static from. 계약 형상(코어 + replyCount) =
 * {@code { commentPublicId, authorNickname, content, createdAt, updatedAt, editable, likeCount, dislikeCount,
 * myReaction, deleted, replyCount }}.
 *
 * <p>{@code editable} 은 요청 주체가 작성자이거나 관리자면 true(비로그인·타인 false, 프론트 버튼 제어 — 인가 권위는 서버, §1.2).
 * {@code myReaction} ∈ {@code LIKE}|{@code DISLIKE}|{@code null}(뷰어 종속 — optional-auth). <b>FC-207 에서는 배선만 열어두고
 * 항상 {@code null}</b>(값 채움은 FC-208 이 뷰어 반응 배치 조회로 담당). {@code deleted} 가 true 면 tombstone(board-spec §13.4) —
 * {@code content}·{@code authorNickname}=null·{@code likeCount/dislikeCount}=0·{@code editable}=false 로 마스킹하되
 * {@code replyCount}·{@code createdAt} 은 유지해 답글 접근을 보존한다.
 */
@Builder
public record CommentResponse(
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
    int replyCount) {

    /**
     * 루트 댓글 항목을 조립한다. tombstone(삭제됐으나 활성 답글 보유)이면 본문·작성자·반응을 마스킹하고, 그 외에는 정상 필드를
     * 싣는다. {@code editable} 은 서비스가 주체·관리자 여부로 판정해 넘긴다(마스킹 시 무시하고 false).
     *
     * @param editable   요청 주체가 작성자이거나 관리자인지(프론트 버튼 제어)
     * @param myReaction 뷰어의 반응(LIKE|DISLIKE|null) — FC-207 은 항상 null, FC-208 이 채운다
     */
    public static CommentResponse fromRoot(
        Comment comment, boolean editable, boolean ownedByMe, String myReaction) {
        if (comment.isTombstone()) {
            return CommentResponse.builder()
                .commentPublicId(comment.getPublicId())
                .authorNickname(null)
                .content(null)
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .editable(false)
                .ownedByMe(false)
                .likeCount(0)
                .dislikeCount(0)
                .myReaction(null)
                .deleted(true)
                .replyCount(comment.getReplyCount())
                .build();
        }
        return CommentResponse.builder()
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
            .replyCount(comment.getReplyCount())
            .build();
    }
}
