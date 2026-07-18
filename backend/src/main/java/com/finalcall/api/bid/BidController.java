package com.finalcall.api.bid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.bid.BidService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 입찰 컨트롤러(bid, EPIC-BID) — 계약 §3.1 {@code /api/v1/auctions/{auctionPublicId}/bids}.
 *
 * <p>{@code AuctionController} 에 붙이지 않고 별도 컨트롤러로 둔다: 도메인 경계를 유지하고, 경매·입찰 티켓이
 * 같은 파일을 동시에 편집하는 상황을 피한다(bid-domain-spec §2.3).
 *
 * <p>입찰은 인증 필요다(SecurityConfig 의 {@code anyRequest().authenticated()}). 입찰자는 컨트롤러가 아니라
 * 서비스가 SecurityContext 에서 도출한다 — 경로·바디 어디에도 입찰자 식별자를 두지 않는다(B-009, IDOR 차단).
 * 반환은 {@link ApiResponse}, 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 */
@RestController
@RequestMapping("/api/v1/auctions/{auctionPublicId}/bids")
@RequiredArgsConstructor
public class BidController {

    private final BidService bidService;

    /** 입찰 — 인증 필요. 성공 201 {@code { bidPublicId, amount, currentHighestAmount, endAt }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<BidPlaceResponse> place(
        @PathVariable String auctionPublicId, @Valid @RequestBody BidPlaceRequest request) {
        return ApiResponse.success(BidPlaceResponse.from(bidService.place(request.toCommand(auctionPublicId))));
    }
}
