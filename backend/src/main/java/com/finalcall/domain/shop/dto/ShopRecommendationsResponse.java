package com.finalcall.domain.shop.dto;

import java.time.Instant;
import java.util.List;

import lombok.Builder;

/** 홈 오늘의 추천 마켓 응답. 계산 기준 시각은 모든 후보 판정에서 동일하다. */
@Builder
public record ShopRecommendationsResponse(
    List<ShopRecommendationItemResponse> items,
    Instant calculatedAt) {
}
