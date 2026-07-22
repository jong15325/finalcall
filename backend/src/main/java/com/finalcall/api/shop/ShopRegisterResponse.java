package com.finalcall.api.shop;

import java.time.Instant;

import com.finalcall.domain.shop.ShopRegisterResult;
import com.finalcall.domain.shop.ShopStatus;

import lombok.Builder;

/**
 * 고정가 등록 응답(shop, 계약 §3.2) — 201 {@code { shopPublicId, status, endAt }}. {@code endAt}은 서버가 설정
 * 일수로 자동 계산한 판매 기한이다(판매자는 고르지 않는다).
 */
@Builder
public record ShopRegisterResponse(String shopPublicId, ShopStatus status, Instant endAt) {

    public static ShopRegisterResponse from(ShopRegisterResult result) {
        return ShopRegisterResponse.builder()
            .shopPublicId(result.shopPublicId())
            .status(result.status())
            .endAt(result.endAt())
            .build();
    }
}
