package com.finalcall.domain.memo.dto;

/**
 * 미열람 개수 응답(memo, 계약 §2.6 GET /me/memos/unread-count → 200 {@code { count }}).
 */
public record MemoUnreadCountResponse(long count) {
}
