package com.finalcall.domain.settlement.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.common.util.NicknameMasker;
import com.finalcall.domain.settlement.entity.OrderRole;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.settlement.entity.SaleOrderStatus;

import lombok.Builder;

/**
 * 거래내역 상세 응답(order, 계약 §4.3 {@code OrderDetail} — {@code GET /orders/{id}}). purchase-spec §5.3 =
 * {@code OrderSummary + { settledAt, itemInstancePublicId }}. record 는 상속 불가라 요약 필드를 평면 재나열한다
 * (AuctionItemResponse·AuctionDetailResponse 선례 — DTO 는 계약 스키마에 1:1).
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
    OrderItemResponse item,
    String itemInstancePublicId,
    long finalPrice,
    SaleOrderStatus status,
    Instant createdAt,
    Instant settledAt,
    Long feeAmount,
    Long settleAmount) {

    /**
     * 요청자 관점으로 상세를 만든다. 당사자 검증({@code ORDER_002})은 서비스가 이미 통과시켰다.
     *
     * @param order    조회된 sale_order(연관 fetch join 완료)
     * @param viewerId 요청자 PK(당사자 검증 통과 — buyer 또는 seller). myRole·판매자 전용 필드 노출 기준
     */
    public static OrderDetailResponse from(SaleOrder order, Long viewerId) {
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
            .item(OrderItemResponse.from(order.getItemInstance()))
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
