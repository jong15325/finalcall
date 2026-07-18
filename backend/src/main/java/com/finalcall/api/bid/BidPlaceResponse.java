package com.finalcall.api.bid;

import java.time.Instant;

import com.finalcall.domain.bid.BidPlaceResult;

import lombok.Builder;

/**
 * 입찰 성립 응답(계약 v1.8 §3.1 — 201 {@code { bidPublicId, amount, currentHighestAmount, endAt }}).
 *
 * <p>{@code endAt} 은 <b>연장 반영 후</b> 값이다. 소프트클로즈가 걸린 입찰의 응답이 옛 마감 시각을 담으면
 * 클라이언트 카운트다운이 실제 마감보다 먼저 0이 되어, 사용자가 재입찰 기회를 놓쳤다고 오인한다.
 *
 * @param bidPublicId          생성된 입찰 외부 식별자
 * @param amount               성립한 입찰액
 * @param currentHighestAmount 성립 직후 최고가(= 방금 성립한 입찰)
 * @param endAt                연장 반영 후 마감 시각
 */
@Builder
public record BidPlaceResponse(String bidPublicId, long amount, long currentHighestAmount, Instant endAt) {

    public static BidPlaceResponse from(BidPlaceResult result) {
        return BidPlaceResponse.builder()
            .bidPublicId(result.bidPublicId())
            .amount(result.amount())
            .currentHighestAmount(result.currentHighestAmount())
            .endAt(result.endAt())
            .build();
    }
}
