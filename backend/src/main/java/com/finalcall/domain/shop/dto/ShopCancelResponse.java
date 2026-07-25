package com.finalcall.domain.shop.dto;

/**
 * 고정가 취소 응답(shop, 계약 §3.2 {@code POST /shops/{id}/cancel}) — 200 {@code { status:"CANCELLED" }}.
 */
public record ShopCancelResponse(String status) {
}
