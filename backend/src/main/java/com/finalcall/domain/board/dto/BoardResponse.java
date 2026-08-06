package com.finalcall.domain.board.dto;

import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.entity.BoardType;
import com.finalcall.domain.board.entity.WritePolicy;

import lombok.Builder;

/**
 * 게시판 응답(EPIC-BOARD, api §6.1). Response = record + @Builder + static from(Entity).
 *
 * <p>외부 식별자는 {@code slug}(사람이 읽는 well-known 키). 인증 게이팅에 쓰는 {@code isActive}는 노출하지 않는다
 * (목록·단건 모두 활성만 서빙하므로 불필요).
 */
@Builder
public record BoardResponse(
    String slug,
    String name,
    String description,
    BoardType boardType,
    WritePolicy writePolicy,
    boolean allowComments,
    int sortOrder) {

    public static BoardResponse from(Board board) {
        return BoardResponse.builder()
            .slug(board.getSlug())
            .name(board.getName())
            .description(board.getDescription())
            .boardType(board.getBoardType())
            .writePolicy(board.getWritePolicy())
            .allowComments(board.isAllowComments())
            .sortOrder(board.getSortOrder())
            .build();
    }
}
