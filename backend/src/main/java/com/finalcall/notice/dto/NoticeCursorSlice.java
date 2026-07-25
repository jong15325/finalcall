package com.finalcall.notice.dto;

import java.util.List;

import com.finalcall.notice.entity.Notice;

/**
 * 커서 조회 결과(Stage D, 도메인 반환 타입). api 계층에서 커서 응답 DTO 로 변환한다.
 *
 * @param notices    이번 페이지 공지 목록(삭제 제외)
 * @param nextCursor 다음 페이지 커서(마지막 id), 비었으면 null
 * @param hasNext    다음 페이지 존재 여부
 */
public record NoticeCursorSlice(List<Notice> notices, Long nextCursor, boolean hasNext) {
}
