package com.finalcall.domain.board.dto;

import com.finalcall.domain.board.entity.ReactionType;

import jakarta.validation.constraints.NotNull;

/**
 * 댓글 반응 토글 요청(EPIC-COMMENT-V2, FC-208, api §6.3 {@code PUT /posts/{postPublicId}/comments/{commentPublicId}/reaction}).
 * 단일 토글 엔드포인트가 등록·전환·취소를 모두 흡수하므로 요청은 반응 종류만 싣는다(board-spec §13.2 표).
 *
 * <p>주체 필드는 없다 — 반응 주체는 SecurityContext 로만 취한다(B-009, IDOR 차단). {@code type} 은 {@link ReactionType}
 * 화이트리스트(LIKE|DISLIKE)로 Jackson 이 역직렬화하며, 미지의 값은 파싱 실패로 400(전역 핸들러), 누락은 {@code @NotNull} 로 400.
 *
 * @param type 반응 종류(필수·LIKE|DISLIKE)
 */
public record CommentReactionRequest(
    @NotNull(message = "반응 종류는 필수입니다.") ReactionType type) {
}
