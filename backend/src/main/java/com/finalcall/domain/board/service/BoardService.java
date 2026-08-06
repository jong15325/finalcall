package com.finalcall.domain.board.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BoardErrorCode;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.board.entity.Board;
import com.finalcall.domain.board.repository.BoardRepository;

import lombok.RequiredArgsConstructor;

/**
 * 게시판 서비스(EPIC-BOARD) — 서비스 컨벤션(notice 선례): 클래스 레벨 {@code @Transactional(readOnly = true)},
 * {@code @ServiceLog} 부착. 이번 티켓(FC-197)은 조회 전용이라 쓰기 오버라이드가 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardService {

    private final BoardRepository boardRepository;

    /** 활성 게시판 목록(정렬 순서 오름차순). api §6.1 {@code GET /api/v1/boards}. */
    @ServiceLog
    public List<Board> getActiveBoards() {
        return boardRepository.findByIsActiveTrueOrderBySortOrderAsc();
    }

    /** 활성 게시판 단건(slug). 미존재·비활성은 {@code BOARD_001}(404). api §6.1 {@code GET /api/v1/boards/{slug}}. */
    @ServiceLog
    public Board getActiveBoard(String slug) {
        return boardRepository.findActiveBySlugOrThrow(slug, BoardErrorCode.BOARD_NOT_FOUND);
    }
}
