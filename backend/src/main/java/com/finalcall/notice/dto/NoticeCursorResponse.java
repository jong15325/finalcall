package com.finalcall.notice.dto;

import java.util.List;

import lombok.Builder;

/**
 * 공지 커서 목록 응답(Stage D). 다음 커서와 hasNext 를 담는 전용 응답 형태.
 */
@Builder
public record NoticeCursorResponse(
    List<NoticeListResponse> content,
    Long nextCursor,
    boolean hasNext) {
    public static NoticeCursorResponse from(NoticeCursorSlice slice) {
        return NoticeCursorResponse.builder()
            .content(slice.notices().stream().map(NoticeListResponse::from).toList())
            .nextCursor(slice.nextCursor())
            .hasNext(slice.hasNext())
            .build();
    }
}
