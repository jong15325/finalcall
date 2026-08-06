package com.finalcall.domain.board.dto;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.finalcall.domain.board.entity.Post;

import lombok.Builder;

/**
 * 게시글 상세 응답(EPIC-BOARD, api §6.2 {@code GET /boards/{slug}/posts/{postPublicId}}). Response = record + {@code @Builder}
 * + static from. {@code editable} 은 요청 주체가 작성자이거나 관리자면 true(비로그인·타인 false) — 프론트 수정/삭제 버튼
 * 노출 제어용이며 인가 권위는 서버다(§1.2). 상세 조회 시 서버가 조회수를 원자 증가하고 응답의 {@code viewCount} 는 그 증가를 반영한다.
 *
 * <p>{@code images} 는 첨부 갤러리(imagePublicId·presigned url·sort 순, FC-200 배선)다 — 서버가 읽기 시점에 presigned
 * GET URL 을 새로 만들어 채운다(클라 저장 금지, board-spec §7.4). 첨부가 없으면 빈 배열이다. {@code boardSlug} 는 경로 slug 게시판 키다.
 */
@Builder
public record PostDetailResponse(
    String postPublicId,
    String boardSlug,
    String title,
    String content,
    String authorNickname,
    @JsonProperty("isPinned") boolean isPinned,
    int viewCount,
    int commentCount,
    List<ImageResponse> images,
    Instant createdAt,
    Instant updatedAt,
    boolean editable) {

    /**
     * 게시글 상세를 조립한다. {@code viewCount} 는 엔티티의 in-memory 값을 그대로 쓴다 — 서비스가 원자 증가 후
     * detach 인스턴스에 {@code increaseViewCount()} 를 반영해 "이번 조회까지 포함된 값"을 넘긴다(board-spec §6.2).
     *
     * @param images 첨부 갤러리(FC-200 배선 전에는 빈 리스트)
     */
    public static PostDetailResponse from(Post post, String boardSlug, boolean editable, List<ImageResponse> images) {
        return PostDetailResponse.builder()
            .postPublicId(post.getPublicId())
            .boardSlug(boardSlug)
            .title(post.getTitle())
            .content(post.getContent())
            .authorNickname(post.getAuthorNickname())
            .isPinned(post.isPinned())
            .viewCount(post.getViewCount())
            .commentCount(post.getCommentCount())
            .images(images)
            .createdAt(post.getCreatedAt())
            .updatedAt(post.getUpdatedAt())
            .editable(editable)
            .build();
    }

    /**
     * 첨부 이미지 항목(계약 §6.2 {@code images[]}) — 게시글 상세 응답 형상의 일부라 post dto 에 중첩 record 로 둔다.
     * {@code url} 은 읽기 시점 생성 presigned GET(단기 TTL, board-spec §7.4).
     */
    public record ImageResponse(String imagePublicId, String url, int sortOrder) {
    }
}
