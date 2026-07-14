package com.finalcall.api.notice;

import java.time.Instant;

import com.finalcall.domain.notice.Notice;
import com.finalcall.domain.notice.NoticeType;

import lombok.Builder;

/**
 * 공지 목록 항목 응답(Stage D). 목록은 내용(content)을 제외한 요약만 담는다.
 */
@Builder
public record NoticeListResponse(
    Long id,
    String title,
    NoticeType type,
    Instant createdAt) {
    public static NoticeListResponse from(Notice notice) {
        return NoticeListResponse.builder()
            .id(notice.getId())
            .title(notice.getTitle())
            .type(notice.getType())
            .createdAt(notice.getCreatedAt())
            .build();
    }
}
