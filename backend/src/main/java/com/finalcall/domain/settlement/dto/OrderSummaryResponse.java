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
 * 거래내역 요약 응답(order, 계약 §4.3 {@code OrderSummary} — {@code GET /me/orders} content 항목). purchase-spec §5.2
 * <b>역할 인지 응답</b>이다: 같은 주문이라도 요청자가 구매자냐 판매자냐에 따라 노출 필드가 다르다.
 *
 * <h2>역할별 노출(B2) — 수수료/정산액은 판매자 전용</h2>
 * {@code feeAmount}·{@code settleAmount} 은 <b>판매자 측 회계</b>다(판매자가 수수료를 부담하고 정산액을 받는다).
 * 구매자는 자기가 지불한 {@code finalPrice} 만 알면 되므로 두 필드를 <b>싣지 않는다</b>({@code myRole==SELLER} 일
 * 때만 값이 있고, 구매자 응답에서는 {@code null} → {@link JsonInclude} {@code NON_NULL} 로 <b>필드 자체가 부재</b>).
 * 거래 상대의 경제 정보 비대칭 노출을 막는다.
 *
 * <p>{@code counterpartyMasked} 는 상대 nickname 마스킹(§3.3 규약 — 앞 2자 + {@code ***})이며 userPublicId·loginId 는
 * 노출하지 않는다. {@code sourceType} 은 코어에서 {@code AUCTION} 만 나간다(BID/BUYNOW 구분은 미노출 — B3).
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OrderSummaryResponse(
    String orderPublicId,
    OrderRole myRole,
    SaleOrderSourceType sourceType,
    String counterpartyMasked,
    OrderItemView item,
    long finalPrice,
    SaleOrderStatus status,
    Instant createdAt,
    Long feeAmount,
    Long settleAmount) {

    /**
     * 요청자 관점으로 요약을 만든다. 연관(buyer·seller·item)은 fetch join 으로 초기화된 상태여야 한다(OSIV off).
     *
     * @param order    조회된 sale_order(당사자 스코프 통과 — viewer 는 buyer 또는 seller)
     * @param viewerId 요청자 PK — myRole·counterparty·판매자 전용 필드 노출 여부의 기준
     */
    public static OrderSummaryResponse from(SaleOrder order, Long viewerId) {
        boolean seller = order.getSeller().getId().equals(viewerId);
        OrderRole myRole = seller ? OrderRole.SELLER : OrderRole.BUYER;
        String counterpartyMasked = seller
            ? NicknameMasker.mask(order.getBuyer().getNickname())
            : NicknameMasker.mask(order.getSeller().getNickname());
        return OrderSummaryResponse.builder()
            .orderPublicId(order.getPublicId())
            .myRole(myRole)
            .sourceType(order.getSourceType())
            .counterpartyMasked(counterpartyMasked)
            .item(OrderItemView.from(order.getItemInstance()))
            .finalPrice(order.getFinalPrice())
            .status(order.getStatus())
            .createdAt(order.getCreatedAt())
            // 판매자 전용(B2) — 구매자면 null 이라 NON_NULL 로 응답에서 제외된다.
            .feeAmount(seller ? order.getFeeAmount() : null)
            .settleAmount(seller ? order.getSettleAmount() : null)
            .build();
    }
}
