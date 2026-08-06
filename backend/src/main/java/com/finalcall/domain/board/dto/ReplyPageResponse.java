package com.finalcall.domain.board.dto;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

import com.finalcall.domain.board.entity.Comment;

import lombok.Builder;

/**
 * 답글 offset 페이지 응답(EPIC-COMMENT-V2, api §6.3 offset 규약 {@code { content, page, size, totalElements, totalPages }}).
 *
 * <p>{@link CommentPageResponse} 와 형태가 같으나 항목 타입이 {@link ReplyResponse}(코어 + mentionedNickname)라 별도 record 로
 * 둔다(계약 형상 정확 — 답글은 replyCount 없음). Spring Data {@code Page} 를 그대로 직렬화하지 않고 명시 record 로 옮긴다
 * (프레임워크 버전 독립). 항목 변환은 서비스가 넘긴 {@code mapper}(주체 종속 editable/myReaction 판정)에 위임한다.
 */
@Builder
public record ReplyPageResponse(
    List<ReplyResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

    public static ReplyPageResponse from(Page<Comment> page, Function<Comment, ReplyResponse> mapper) {
        return ReplyPageResponse.builder()
            .content(page.getContent().stream().map(mapper).toList())
            .page(page.getNumber())
            .size(page.getSize())
            .totalElements(page.getTotalElements())
            .totalPages(page.getTotalPages())
            .build();
    }
}
