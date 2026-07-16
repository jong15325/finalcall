package com.finalcall.api.notice;

import com.finalcall.domain.notice.NoticeType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 공지 수정 요청(Stage D).
 */
public record NoticeUpdateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,

    @NotBlank(message = "내용은 필수입니다.") @Size(max = 2000, message = "내용은 2000자 이하여야 합니다.") String content,

    @NotNull(message = "유형은 필수입니다.") NoticeType type) {
}
