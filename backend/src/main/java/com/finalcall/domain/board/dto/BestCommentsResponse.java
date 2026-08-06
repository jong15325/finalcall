package com.finalcall.domain.board.dto;

import java.util.List;

import lombok.Builder;

/**
 * BEST 댓글 응답(EPIC-COMMENT-V2, FC-209, api §6.3 {@code GET /posts/{postPublicId}/comments/best}). 계약 형상 =
 * {@code { comments: [ CommentResponse + { replyCount } ... ] }}.
 *
 * <p>BEST 는 정렬 목록({@code GET …/comments})과 <b>분리된 고정 랭킹</b>이라 페이지네이션에 얽지 않고 단순 배열로 반환한다
 * (board-spec §13.3). 항목은 루트 댓글 {@link CommentResponse}(replyCount 포함) 그대로다 — 서비스가 뷰어 종속
 * {@code myReaction}·{@code editable} 을 채워 넘긴다. 임계 미달이면 빈 배열({@code comments: []}, BEST 섹션 미노출).
 */
@Builder
public record BestCommentsResponse(
    List<CommentResponse> comments) {

    /** BEST 항목 리스트를 응답으로 감싼다(빈 리스트면 빈 배열). */
    public static BestCommentsResponse of(List<CommentResponse> comments) {
        return BestCommentsResponse.builder().comments(comments).build();
    }
}
