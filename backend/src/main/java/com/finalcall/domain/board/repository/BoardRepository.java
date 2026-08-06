package com.finalcall.domain.board.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.ErrorCode;
import com.finalcall.domain.board.entity.Board;

/**
 * 게시판 리포지토리(EPIC-BOARD). slug 자연키 기반 조회 — {@code findBySlugOrThrow} default 메서드 패턴(notice 선례).
 *
 * <p>목록·단건 모두 활성({@code is_active=true}) 게시판만 노출한다(비활성=목록 비노출·단건 404, api §6.1).
 */
public interface BoardRepository extends JpaRepository<Board, Long> {

    /** 활성 게시판 목록을 정렬 순서(오름차순)로 조회한다. api §6.1 {@code GET /api/v1/boards}. */
    List<Board> findByIsActiveTrueOrderBySortOrderAsc();

    /** 활성 게시판 단건(slug). 비활성·미존재는 빈 Optional → 호출부에서 {@code BOARD_001}(404). */
    Optional<Board> findBySlugAndIsActiveTrue(String slug);

    /**
     * OrThrow default 메서드 패턴 — 활성 게시판이 없으면 {@link BusinessException}.
     * 비활성 게시판은 미존재와 동일하게 취급한다(api §6.1 slug 미존재·비활성 = {@code BOARD_001}).
     */
    default Board findActiveBySlugOrThrow(String slug, ErrorCode errorCode) {
        return findBySlugAndIsActiveTrue(slug).orElseThrow(() -> new BusinessException(errorCode));
    }
}
