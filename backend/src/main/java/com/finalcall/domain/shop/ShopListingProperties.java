package com.finalcall.domain.shop;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 고정가 등록 기한 정책(shop, shop-spec §3.1 · 게이트2 C5 정정 2026-07-22).
 *
 * <p><b>판매자는 기한을 고르지 않는다.</b> 등록 시점에 서버가 {@code end_at = now + defaultDurationDays} 로 자동
 * 계산해 채운다. 이 값은 컴파일 상수가 아니라 <b>관리자 조정 설정</b>이라({@code AuctionService} 의 소프트클로즈
 * 상수와 달리 게이트1 이 "관리자 조정 설정 옵션"을 명시) {@code @ConfigurationProperties} + {@code @Validated} 로
 * 바인딩한다(CLAUDE.md §4 — 하드코딩 금지, {@code FeePolicyProperties}·{@code ClosingWorkerProperties} 선례).
 * 향후 DB 설정 이관 여지를 남긴다. 값이 비었거나 0 이하면 <b>부팅이 실패</b>한다(조용한 기본값 대체 금지).
 */
@Validated
@ConfigurationProperties(prefix = "shop.listing")
public record ShopListingProperties(

    /** 기본 판매 기한(일). 등록 시 {@code end_at = now + 이 값(일)} 으로 자동 계산한다. 기본 7일. */
    @Positive int defaultDurationDays) {
}
