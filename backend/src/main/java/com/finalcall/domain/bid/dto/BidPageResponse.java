package com.finalcall.domain.bid.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import com.finalcall.domain.bid.entity.Bid;

import lombok.Builder;

/**
 * 입찰 이력 offset 페이지 응답(bid, 계약 §1.3 offset 규약 {@code { content, page, size, totalElements, totalPages }}).
 *
 * <p>Spring Data {@code Page} 를 그대로 직렬화하지 않고 명시 record 로 옮긴다 — {@code Page} 의 JSON 형태는
 * Spring 버전에 따라 바뀌는 구현 세부사항이라 계약을 그것에 묶으면 프레임워크 업그레이드가 곧 계약 변경이 된다.
 */
@Builder
public record BidPageResponse(
    List<BidSummaryResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {

    public static BidPageResponse from(Page<Bid> page) {
        return BidPageResponse.builder()
            .content(page.getContent().stream().map(BidSummaryResponse::from).toList())
            .page(page.getNumber())
            .size(page.getSize())
            .totalElements(page.getTotalElements())
            .totalPages(page.getTotalPages())
            .build();
    }
}
