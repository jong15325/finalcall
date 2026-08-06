package com.finalcall.domain.board.repository;

import java.util.List;

import com.finalcall.domain.board.entity.Post;
import com.finalcall.domain.board.entity.PostCursor;

/**
 * 게시글 커서 목록 계약(EPIC-BOARD, QueryDSL 구현은 {@link PostRepositoryImpl}). 삭제({@code is_deleted=true})는 제외하고
 * <b>{@code is_pinned DESC, id DESC}</b>(고정 우선·최신순, board-spec §6.3)로 안정 정렬한다. hasNext 판단을 위해
 * {@code size+1} 건을 over-fetch 한다(서비스가 슬라이싱).
 */
public interface PostRepositoryCustom {

    /** 게시판별 글 목록(board=? AND 미삭제, is_pinned DESC·id DESC keyset). ix_post_board_list 커버. */
    List<Post> findByBoardCursor(Long boardId, PostCursor cursor, int size);
}
