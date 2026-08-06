package com.finalcall.domain.board.entity;

/**
 * 댓글 공감/비공감 반응 종류(EPIC-COMMENT-V2, FC-208 · board-spec §13.2 · erd §4.5 {@code comment_reaction.reaction_type}).
 * {@code comment_reaction} 행에 유저당 댓글당 1개만 존재하며, 전환(LIKE↔DISLIKE)은 이 값의 UPDATE 로 표현한다(취소는 행 DELETE).
 *
 * <p>웹 계약(반응 토글 요청 {@code { type }}·응답 {@code myReaction})의 문자열 값과 1:1(대소문자 그대로) — 요청 역직렬화는
 * Jackson 이 이 상수명으로 매핑하고(미지의 값은 400), 응답은 {@code name()} 을 싣는다. VARCHAR(10) 컬럼에
 * {@code @Enumerated(STRING)} 로 저장한다.
 */
public enum ReactionType {

    /** 공감 — {@code comment.like_count} 비정규화 카운트 대상. */
    LIKE,
    /** 비공감 — {@code comment.dislike_count} 비정규화 카운트 대상. */
    DISLIKE
}
