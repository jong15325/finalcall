package com.finalcall.domain.delivery.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.item.dto.ItemSummaryResponse;
import com.finalcall.domain.item.entity.ItemInstance;

import lombok.Builder;

/**
 * 배송 상세 응답(delivery, FC-192 — 계약 §4.6.1 {@code GET /me/deliveries/{id}}). 계약상
 * {@code DeliverySummary + { recipientNickname }} 이다. record 는 상속 불가라 요약 필드를 평면 재나열한다
 * ({@link com.finalcall.domain.settlement.dto.OrderDetailResponse} 선례 — DTO 는 계약 스키마에 1:1).
 *
 * <p>당사자(recipient=주체)만 조회하므로 수령 닉네임({@code recipientNickname})을 마스킹 없이 노출한다(자기 배송).
 * {@code claimToken}·{@code claimedAt} 은 요약과 동일하게 미노출(내부 리스 메커니즘, §10.1).
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeliveryDetailResponse(
    String deliveryPublicId,
    DeliveryStatus status,
    ItemSummaryResponse item,
    String itemInstancePublicId,
    Instant createdAt,
    Instant appliedAt,
    String recipientNickname) {

    /**
     * 배송 + 대상 아이템 인스턴스로 상세를 만든다. 당사자 검증(recipient=주체)은 서비스가 이미 통과시켰다.
     * {@code instance} 의 template·skill1·skill2 는 fetch join 으로 초기화된 상태여야 한다(OSIV off).
     */
    public static DeliveryDetailResponse from(ItemDelivery delivery, ItemInstance instance) {
        return DeliveryDetailResponse.builder()
            .deliveryPublicId(delivery.getPublicId())
            .status(delivery.getStatus())
            .item(ItemSummaryResponse.from(instance))
            .itemInstancePublicId(instance.getPublicId())
            .createdAt(delivery.getCreatedAt())
            .appliedAt(delivery.getAppliedAt())
            .recipientNickname(delivery.getRecipientNickname())
            .build();
    }
}
