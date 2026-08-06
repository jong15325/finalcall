package com.finalcall.domain.board.entity;

/**
 * 게시판 유형(EPIC-BOARD, board-spec §3). 프론트 렌더링 변주·정렬 힌트용이며 <b>인가에는 관여하지 않는다</b>
 * (인가는 {@link WritePolicy}가 단독 결정).
 *
 * <ul>
 *   <li>{@code GENERAL} — 일반 게시판(커뮤니티).
 *   <li>{@code NOTICE} — 공지 게시판(흡수된 notice).
 *   <li>{@code EVENT} — 이벤트 게시판(배너 강조 등).
 * </ul>
 */
public enum BoardType {

    GENERAL,
    NOTICE,
    EVENT
}
