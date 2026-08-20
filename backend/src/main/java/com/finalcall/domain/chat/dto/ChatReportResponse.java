package com.finalcall.domain.chat.dto;

import java.time.Instant;

import com.finalcall.domain.chat.entity.ChatReport;

import lombok.Builder;

/** 생성된 신고의 외부 식별자와 생성 시각. */
@Builder
public record ChatReportResponse(
    String reportPublicId,
    Instant createdAt) {

    public static ChatReportResponse from(ChatReport report) {
        return ChatReportResponse.builder()
            .reportPublicId(report.getPublicId())
            .createdAt(report.getCreatedAt())
            .build();
    }
}
