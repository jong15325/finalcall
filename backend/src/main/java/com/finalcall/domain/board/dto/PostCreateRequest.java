package com.finalcall.domain.board.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 게시글 작성 요청(EPIC-BOARD, api §6.2 {@code POST /boards/{slug}/posts}). 형식 검증은 Bean Validation, 한국어 메시지.
 *
 * <p>작성자·조회수·댓글수 필드는 요청에 없다 — 작성자는 SecurityContext 주체로만 취하고(B-009, IDOR 차단) 카운터는
 * 서버가 0 으로 세팅한다. {@code imagePublicIds} 는 §6.4 업로드로 받은 이미지의 귀속 목록이다(≤10) — 실제 바인딩(post_id
 * 세팅·업로더 검증)은 이미지 인프라를 소유하는 FC-200 이 배선한다. 이 티켓은 계약 형상·상한 검증만 수용한다.
 *
 * @param title          제목(필수·≤200)
 * @param content        본문(필수·≤10000, TEXT)
 * @param imagePublicIds 귀속 이미지 public_id 목록(선택·≤10)
 */
public record PostCreateRequest(
    @NotBlank(message = "제목은 필수입니다.") @Size(max = 200, message = "제목은 200자 이하여야 합니다.") String title,

    @NotBlank(message = "내용은 필수입니다.") @Size(max = 10000, message = "내용은 10000자 이하여야 합니다.") String content,

    @Size(max = 10, message = "이미지는 최대 10장까지 첨부할 수 있습니다.") List<String> imagePublicIds) {
}
