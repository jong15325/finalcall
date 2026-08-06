package com.finalcall.domain.board.dto;

import java.util.List;
import java.util.function.Function;

import org.springframework.data.domain.Page;

import com.finalcall.domain.board.entity.Comment;

import lombok.Builder;

/**
 * 댓글 offset 페이지 응답(EPIC-BOARD, api §6.3 offset 규약 {@code { content, page, size, totalElements, totalPages }}).
 *
 * <p>Spring Data {@code Page} 를 그대로 직렬화하지 않고 명시 record 로 옮긴다(BidPageResponse 선례) — {@code Page} 의 JSON
 * 형태는 Spring 버전에 따라 바뀌는 구현 세부사항이라 계약을 그것에 묶으면 프레임워크 업그레이드가 곧 계약 변경이 된다.
 *
 * <p>{@code CommentResponse.editable} 은 요청 주체(작성자·관리자 여부)에 의존하므로 항목 변환을 서비스가 넘긴 {@code mapper}
 * 로 위임한다(주체 판정은 서비스 책임, DTO 는 형상 조립만).
 */
@Builder
public record CommentPageResponse(
    List<CommentResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

    public static CommentPageResponse from(Page<Comment> page, Function<Comment, CommentResponse> mapper) {
        return CommentPageResponse.builder()
            .content(page.getContent().stream().map(mapper).toList())
            .page(page.getNumber())
            .size(page.getSize())
            .totalElements(page.getTotalElements())
            .totalPages(page.getTotalPages())
            .build();
    }
}
