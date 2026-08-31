package com.finalcall.domain.shop.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.shop.dto.ShopRecommendationsResponse;
import com.finalcall.domain.shop.service.ShopRecommendationService;

import lombok.RequiredArgsConstructor;

/** 로그인 여부와 무관한 홈 오늘의 추천 마켓 공개 조회 API. */
@RestController
@RequestMapping("/api/v1/home")
@RequiredArgsConstructor
public class HomeShopRecommendationController {

    private final ShopRecommendationService shopRecommendationService;

    @GetMapping("/shop-recommendations")
    public ApiResponse<ShopRecommendationsResponse> recommendations() {
        return ApiResponse.success(shopRecommendationService.getRecommendations());
    }
}
