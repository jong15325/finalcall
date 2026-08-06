package com.finalcall.domain.board.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.finalcall.domain.board.entity.Post;

import lombok.Builder;

/**
 * 게시글 목록 항목(EPIC-BOARD, api §6.2 {@code GET /boards/{slug}/posts}). 커서 목록의 항목 타입 — 웹 DTO 허용 접미사
 * {@code Response} 계열 중 목록 항목은 {@code *Summary}(board-spec §10). Response = record + {@code @Builder} + static from.
 *
 * <p>{@code thumbnailUrl} 은 글의 첫 첨부 이미지 presigned GET URL 이다(FC-200 배선). 첨부가 없으면 {@code null}(계약
 * §6.2). 서버가 읽기 시점에 배치로 생성하며(클라 저장 금지), 값 주입은 {@code PostService.getPosts} 가
 * {@code PostImageService.thumbnailsOf} 로 조립한다. {@code authorNickname} 은 작성 시점 스냅샷(흡수 공지·시스템 글은 시드 표시명).
 */
@Builder
public record PostSummary(
    String postPublicId,
    String title,
    String authorNickname,
    // record 의 boolean 컴포넌트가 Jackson 에서 'pinned' 로 오인 매핑되지 않도록 계약 키(isPinned)를 명시한다.
    @JsonProperty("isPinned") boolean isPinned,
    int viewCount,
    int commentCount,
    String thumbnailUrl,
    Instant createdAt) {

    /** 첨부 없는 목록 항목(썸네일 null) — 이미지 배선 밖 호출 편의. */
    public static PostSummary from(Post post) {
        return from(post, null);
    }

    /**
     * 목록 항목을 조립한다(FC-200 이미지 배선). {@code thumbnailUrl} 은 글의 첫 첨부 이미지 presigned GET URL 이며
     * 첨부가 없으면 null 이다(계약 §6.2, 서버가 읽기 시점에 배치 생성 — {@code PostImageService.thumbnailsOf}).
     *
     * @param thumbnailUrl 첫 첨부 이미지 presigned URL(없으면 null)
     */
    public static PostSummary from(Post post, String thumbnailUrl) {
        return PostSummary.builder()
            .postPublicId(post.getPublicId())
            .title(post.getTitle())
            .authorNickname(post.getAuthorNickname())
            .isPinned(post.isPinned())
            .viewCount(post.getViewCount())
            .commentCount(post.getCommentCount())
            .thumbnailUrl(thumbnailUrl)
            .createdAt(post.getCreatedAt())
            .build();
    }
}
