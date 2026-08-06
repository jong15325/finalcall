package com.finalcall.domain.board.dto;

import java.util.List;

import com.finalcall.domain.board.entity.Board;

/**
 * 게시판 목록 응답(EPIC-BOARD, api §6.1) — 계약 형상 {@code { boards: [ BoardResponse... ] }}.
 *
 * <p>배열을 최상위로 직렬화하지 않고 {@code boards} 필드로 감싼다(향후 필드 가법 확장 여지·JSON 최상위 배열 회피).
 */
public record BoardListResponse(List<BoardResponse> boards) {

    public static BoardListResponse from(List<Board> boards) {
        return new BoardListResponse(boards.stream().map(BoardResponse::from).toList());
    }
}
