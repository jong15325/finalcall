package com.finalcall.domain.board.dto;

import lombok.Builder;

/**
 * 이미지 업로드 응답(EPIC-BOARD, api §6.4 {@code POST /api/v1/board-images}). Response = record + {@code @Builder}.
 *
 * <p>{@code imagePublicId} 는 게시글 저장 시 {@code imagePublicIds[]} 로 귀속에 쓰는 외부 식별자(ULID)다. {@code url} 은
 * 즉시 미리보기용 presigned GET URL(단기 TTL)이며 클라는 저장·재사용하지 않는다 — 목록·상세는 서버가 읽기 시점에 새로
 * 만든 presigned url 을 준다(board-spec §7.1·§7.4).
 *
 * @param imagePublicId 업로드된 이미지 public_id(ULID)
 * @param url           presigned GET URL(단기 TTL)
 */
@Builder
public record BoardImageUploadResponse(String imagePublicId, String url) {
}
