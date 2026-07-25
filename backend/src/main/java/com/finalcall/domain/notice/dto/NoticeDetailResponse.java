package com.finalcall.domain.notice.dto;

import java.time.Instant;

import com.finalcall.domain.notice.entity.Notice;
import com.finalcall.domain.notice.entity.NoticeType;

import lombok.Builder;

/**
 * 공지 단건 응답(Stage D). Response 는 record + @Builder + static from(Entity).
 */
@Builder
public record NoticeDetailResponse(
    Long id,
    String title,
    String content,
    NoticeType type,
    String createdBy,
    Instant createdAt,
    Instant updatedAt) {
    public static NoticeDetailResponse from(Notice notice) {
        return NoticeDetailResponse.builder()
            .id(notice.getId())
            .title(notice.getTitle())
            .content(notice.getContent())
            .type(notice.getType())
            .createdBy(notice.getCreatedBy())
            .createdAt(notice.getCreatedAt())
            .updatedAt(notice.getUpdatedAt())
            .build();
    }
}
