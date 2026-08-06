package com.finalcall.domain.board.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.board.dto.BoardListResponse;
import com.finalcall.domain.board.dto.BoardResponse;
import com.finalcall.domain.board.service.BoardService;

import lombok.RequiredArgsConstructor;

/**
 * 게시판 컨트롤러(EPIC-BOARD, api §6.1) — 컨트롤러 컨벤션: 반환 타입 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러).
 *
 * <p>목록·단건 조회는 <b>공개</b>(인증 불요, SecurityConfig permitAll). 게시판 생성/수정 API 는 다음 에픽(관리자 CRUD).
 */
@RestController
@RequestMapping("/api/v1/boards")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService boardService;

    /** 활성 게시판 목록(정렬 순서). {@code { boards: [...] }}. */
    @GetMapping
    public ApiResponse<BoardListResponse> getBoards() {
        return ApiResponse.success(BoardListResponse.from(boardService.getActiveBoards()));
    }

    /** 활성 게시판 단건(slug). 미존재·비활성은 {@code BOARD_001}(404). */
    @GetMapping("/{slug}")
    public ApiResponse<BoardResponse> getBoard(@PathVariable String slug) {
        return ApiResponse.success(BoardResponse.from(boardService.getActiveBoard(slug)));
    }
}
