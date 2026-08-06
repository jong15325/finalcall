package com.finalcall.domain.board.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 게시글 수정 요청(EPIC-BOARD, api §6.2 {@code PUT /boards/{slug}/posts/{postPublicId}}). 작성 요청과 동일 스키마·검증.
 *
 * <p>{@code imagePublicIds} 는 최종 이미지 집합(누락분 언바인딩·신규분 바인딩)이나, 실제 바인딩은 이미지 인프라를
 * 소유하는 FC-200 이 배선한다 — 이 티켓은 계약 형상·상한 검증만 수용한다(FC-198 은 제목·본문만 갱신).
 *
 * @param title          제목(필수·≤200)
 * @param content        본문(필수·≤10000, TEXT)
 * @param imagePublicIds 최종 귀속 이미지 public_id 목록(선택·≤10)
 */
public record PostUpdateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,

    @NotBlank(message = "내용은 필수입니다.") @Size(max = 10000, message = "내용은 10000자 이하여야 합니다.") String content,

    @Size(max = 10, message = "이미지는 최대 10장까지 첨부할 수 있습니다.") List<String> imagePublicIds) {
}
