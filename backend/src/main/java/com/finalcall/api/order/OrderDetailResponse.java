package com.finalcall.api.order;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.common.util.NicknameMasker;
import com.finalcall.domain.settlement.OrderRole;
import com.finalcall.domain.settlement.OrderView;
import com.finalcall.domain.settlement.SaleOrder;
import com.finalcall.domain.settlement.SaleOrderSourceType;
import com.finalcall.domain.settlement.SaleOrderStatus;

import lombok.Builder;

/**
 * 거래내역 상세 응답(order, 계약 §4.3 {@code OrderDetail} — {@code GET /orders/{id}}). purchase-spec §5.3 =
 * {@code OrderSummary + { settledAt, itemInstancePublicId }}. record 는 상속 불가라 요약 필드를 평면 재나열한다
 * ({@link AuctionItemView}·AuctionDetailResponse 선례 — DTO 는 계약 스키마에 1:1).
 *
 * <p>역할별 노출 규칙은 요약과 동일하다(purchase-spec §5.2): {@code feeAmount}·{@code settleAmount} 은 판매자 전용
 * 이라 구매자 응답에서는 {@code null} → {@link JsonInclude} {@code NON_NULL} 로 필드 자체가 부재한다.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderDetailResponse(
    String orderPublicId,
    OrderRole myRole,
    SaleOrderSourceType sourceType,
    String counterpartyMasked,
    OrderItemView item,
    String itemInstancePublicId,
    long finalPrice,
    SaleOrderStatus status,
    Instant createdAt,
    Instant settledAt,
    Long feeAmount,
    Long settleAmount) {

    /** 요청자 관점으로 상세를 만든다. 당사자 검증({@code ORDER_002})은 서비스가 이미 통과시켰다. */
    public static OrderDetailResponse from(OrderView view) {
        SaleOrder order = view.order();
        Long viewerId = view.viewerId();
        boolean seller = order.getSeller().getId().equals(viewerId);
        OrderRole myRole = seller ? OrderRole.SELLER : OrderRole.BUYER;
        String counterpartyMasked = seller
            ? NicknameMasker.mask(order.getBuyer().getNickname())
            : NicknameMasker.mask(order.getSeller().getNickname());
        return OrderDetailResponse.builder()
            .orderPublicId(order.getPublicId())
            .myRole(myRole)
            .sourceType(order.getSourceType())
            .counterpartyMasked(counterpartyMasked)
            .item(OrderItemView.from(order.getItemInstance()))
            .itemInstancePublicId(order.getItemInstance().getPublicId())
            .finalPrice(order.getFinalPrice())
            .status(order.getStatus())
            .createdAt(order.getCreatedAt())
            .settledAt(order.getSettledAt())
            // 판매자 전용(B2) — 구매자면 null 이라 NON_NULL 로 응답에서 제외된다.
            .feeAmount(seller ? order.getFeeAmount() : null)
            .settleAmount(seller ? order.getSettleAmount() : null)
            .build();
    }
}
