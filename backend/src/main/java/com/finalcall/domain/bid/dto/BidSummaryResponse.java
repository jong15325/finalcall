package com.finalcall.domain.bid.dto;

import java.time.Instant;

import com.finalcall.common.util.NicknameMasker;
import com.finalcall.domain.bid.entity.Bid;
import com.finalcall.domain.bid.entity.BidStatus;

import lombok.Builder;

/**
 * 입찰 이력 항목 응답(bid, 계약 §3.3 {@code BidSummary} — {@code GET /auctions/{id}/bids} content 항목).
 *
 * <p><b>인증 불요 엔드포인트의 응답이다.</b> 그래서 필드 집합 자체가 보안 경계다:
 * <ul>
 *   <li>입찰자는 {@link NicknameMasker} 마스킹 결과만 싣는다 — {@code userPublicId}·{@code loginId}·실 nickname·
 *       내부 PK 를 어떤 형태로도 노출하지 않는다(SEC-007 회원 열거 방지).</li>
 *   <li>홀드(에스크로)·잔액 등 자금 정보를 싣지 않는다(타인 자금 상태 노출 금지). 입찰액은 경매 진행 정보라
 *       공개 대상이다.</li>
 * </ul>
 *
 * <p>필드를 늘릴 때는 "미인증 제3자가 봐도 되는가"를 먼저 통과시켜야 한다(bid-domain-spec §7.2·§9).
 */
@Builder
public record BidSummaryResponse(
    String bidPublicId,
    String bidderMasked,
    long amount,
    BidStatus status,
    Instant createdAt) {

    /** 입찰자는 {@code JOIN FETCH} 로 초기화된 상태여야 한다(OSIV off — 리포지토리 쿼리가 보장). */
    public static BidSummaryResponse from(Bid bid) {
        return BidSummaryResponse.builder()
            .bidPublicId(bid.getPublicId())
            .bidderMasked(NicknameMasker.mask(bid.getBidder().getNickname()))
            .amount(bid.getAmount())
            .status(bid.getStatus())
            .createdAt(bid.getCreatedAt())
            .build();
    }
}
