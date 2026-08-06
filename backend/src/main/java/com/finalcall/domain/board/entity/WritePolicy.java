package com.finalcall.domain.board.entity;

/**
 * 게시판 쓰기 권한 정책(EPIC-BOARD, board-spec §3). 게시판별로 누가 글을 쓰는지 결정한다 — 인가의 단독 축.
 *
 * <ul>
 *   <li>{@code ADMIN_ONLY} — 관리자({@code ROLE_ADMIN})만 작성/수정/삭제(공지·이벤트).
 *   <li>{@code AUTHENTICATED} — 로그인 회원 누구나 작성(커뮤니티).
 * </ul>
 */
public enum WritePolicy {

    ADMIN_ONLY,
    AUTHENTICATED
}
