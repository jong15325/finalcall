package com.finalcall.domain.memo.dto;

import java.time.Instant;

import com.finalcall.domain.memo.entity.Memo;

import lombok.Builder;

/**
 * 메모 발신 응답(memo, 계약 §2.6 POST /me/memos → 201 {@code { memoPublicId, createdAt }}).
 */
@Builder
public record MemoSendResponse(
    String memoPublicId,
    Instant createdAt) {

    public static MemoSendResponse from(Memo memo) {
        return MemoSendResponse.builder()
            .memoPublicId(memo.getPublicId())
            .createdAt(memo.getCreatedAt())
            .build();
    }
}
