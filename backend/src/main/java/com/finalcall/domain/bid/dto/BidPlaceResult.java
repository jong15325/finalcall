package com.finalcall.domain.bid.dto;

import java.time.Instant;

/**
 * 입찰 성립 결과(계약 v1.8 §3.1 — 응답 201 {@code { bidPublicId, amount, currentHighestAmount, endAt }}).
 *
 * @param bidPublicId          생성된 입찰의 외부 식별자(ULID)
 * @param amount               성립한 입찰액
 * @param currentHighestAmount 성립 직후 최고가 — 방금 성립한 입찰이 곧 최고가이므로 {@code amount} 와 같다
 * @param endAt                <b>연장 반영 후</b> 마감 시각(계약 v1.8 명시). 소프트클로즈가 걸렸다면 밀려난 값이다
 */
public record BidPlaceResult(String bidPublicId, long amount, long currentHighestAmount, Instant endAt) {
}
