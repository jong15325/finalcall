package com.finalcall.domain.shop.dto;

import com.finalcall.domain.shop.entity.ShopRecommendationReason;

import lombok.Builder;

/** 홈 추천 한 건의 이유와 기존 고정가 요약 응답을 묶는다. */
@Builder
public record ShopRecommendationItemResponse(
    ShopRecommendationReason reason,
    ShopSummaryResponse shop) {
}
