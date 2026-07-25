package com.finalcall.notice.dto;

import com.finalcall.notice.entity.NoticeType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 공지 생성 요청(Stage D). 형식 검증은 Bean Validation, 한국어 메시지.
 */
public record NoticeCreateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,

    @NotBlank(message = "내용은 필수입니다.") @Size(max = 2000, message = "내용은 2000자 이하여야 합니다.") String content,

    @NotNull(message = "유형은 필수입니다.") NoticeType type) {
}
