package com.finalcall.domain.delivery.dto;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.item.dto.ItemSummaryResponse;
import com.finalcall.domain.item.entity.ItemInstance;

import lombok.Builder;

/**
 * 배송 요약 응답(delivery, FC-192 — 계약 §4.6.1 {@code DeliverySummary}, {@code GET /me/deliveries} content 항목).
 * <b>읽기 전용</b> — 구매자가 자기 배송 상태를 조회한다.
 *
 * <p>{@code item} 블록은 계약 §3.3·§4.2 공용 요약({@link ItemSummaryResponse})을 재사용한다 — 프론트(FC-190)가
 * {@code itemInstancePublicId} 로 인벤/구매내역 항목과 교차 조회하므로 item 형상을 인벤토리와 동일하게 맞춘다.
 * 배송 행은 자족 스냅샷을 보유하지만(게임 boundary 용, delivery-domain-spec §6.2), 표시명·스킬명은 스냅샷에 없어
 * item_instance + template + skill live join 에서 구성한다(order 요약 선례). {@code status} 는 그대로 노출한다
 * (PENDING/CLAIMED/APPLIED/DEFERRED/FAILED — 게임 배송 진행 표시). <b>{@code claimToken}·{@code claimedAt} 은
 * 미노출</b>(내부 리스 메커니즘, §10.1). {@code appliedAt} 은 미도착이면 null 이라 {@link JsonInclude} NON_NULL 로 제외된다.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeliverySummaryResponse(
    String deliveryPublicId,
    DeliveryStatus status,
    ItemSummaryResponse item,
    String itemInstancePublicId,
    Instant createdAt,
    Instant appliedAt) {

    /**
     * 배송 + 대상 아이템 인스턴스로 요약을 만든다. {@code instance} 의 template·skill1·skill2 는 fetch join 으로
     * 초기화된 상태여야 한다(OSIV off — 리포지토리 쿼리가 보장).
     *
     * @param delivery 조회된 배송 행(수령자 스코프 통과 — recipient = 주체)
     * @param instance 배송 대상 item_instance(id = delivery.itemInstanceId, 연관 fetch join 완료)
     */
    public static DeliverySummaryResponse from(ItemDelivery delivery, ItemInstance instance) {
        return DeliverySummaryResponse.builder()
            .deliveryPublicId(delivery.getPublicId())
            .status(delivery.getStatus())
            .item(ItemSummaryResponse.from(instance))
            .itemInstancePublicId(instance.getPublicId())
            .createdAt(delivery.getCreatedAt())
            .appliedAt(delivery.getAppliedAt())
            .build();
    }
}
