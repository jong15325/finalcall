package com.finalcall.domain.settlement.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.settlement.dto.PurchaseResponse;
import com.finalcall.domain.settlement.service.PurchaseService;

import lombok.RequiredArgsConstructor;

/**
 * 즉시구매 컨트롤러(purchase, EPIC-PURCHASE) — 계약 §3.1 {@code POST /api/v1/auctions/{auctionPublicId}/purchase}.
 *
 * <p>{@code AuctionController}·{@code BidController} 에 붙이지 않고 별도 컨트롤러로 둔다: 도메인 경계를 유지하고
 * 티켓 간 파일 동시 편집을 피한다({@code BidController} 선례). 즉시구매는 인증 필요다 — 구매자는 컨트롤러가 아니라
 * 서비스가 SecurityContext 에서 도출한다(B-009, IDOR 차단). <b>요청 본문 없음</b>(경매는 경로, 금액은 서버가
 * {@code buy_now_price} 로 확정 — 클라이언트 금액 신뢰 없음). 반환은 {@link ApiResponse}, try-catch 금지(전역 핸들러).
 */
@RestController
@RequestMapping("/api/v1/auctions/{auctionPublicId}/purchase")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchaseService;

    /** 즉시구매 — 인증 필요. 성공 201 {@code { orderPublicId, finalPrice }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PurchaseResponse> purchase(@PathVariable String auctionPublicId) {
        return ApiResponse.success(PurchaseResponse.from(purchaseService.purchase(auctionPublicId)));
    }
}
