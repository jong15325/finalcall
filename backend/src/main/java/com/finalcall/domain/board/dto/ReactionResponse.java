package com.finalcall.domain.board.dto;

import com.finalcall.domain.board.entity.ReactionType;

import lombok.Builder;

/**
 * 댓글 반응 토글 응답(EPIC-COMMENT-V2, FC-208, api §6.3). 반영 후 최종 상태 {@code { likeCount, dislikeCount, myReaction }} —
 * 프론트 낙관적 업데이트의 권위 응답이다(board-spec §13.2).
 *
 * <p>{@code myReaction} ∈ {@code LIKE}|{@code DISLIKE}|{@code null} — 토글 결과 뷰어의 반응이다. 취소(같은 종류 재요청)면
 * {@code null}, 등록·전환이면 요청 종류다. {@code likeCount}·{@code dislikeCount} 는 동일 TX 원자 UPDATE 로 반영된 카운트다
 * (요청 주체의 반응 델타가 정확히 반영된 값).
 */
@Builder
public record ReactionResponse(
    int likeCount,
    int dislikeCount,
    String myReaction) {

    /** 토글 결과를 조립한다. {@code myReaction} 이 {@code null}(취소)이면 문자열도 {@code null}, 아니면 상수명을 싣는다. */
    public static ReactionResponse of(int likeCount, int dislikeCount, ReactionType myReaction) {
        return ReactionResponse.builder()
            .likeCount(likeCount)
            .dislikeCount(dislikeCount)
            .myReaction(myReaction == null ? null : myReaction.name())
            .build();
    }
}
