package com.finalcall.domain.bid.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.bid.dto.BidPageResponse;
import com.finalcall.domain.bid.dto.BidPlaceRequest;
import com.finalcall.domain.bid.dto.BidPlaceResponse;
import com.finalcall.domain.bid.service.BidService;

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

    /** 페이지 크기 상한. 인증 불요 엔드포인트라 무제한 size 는 그 자체로 증폭 공격 표면이다. */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 offset 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final BidService bidService;

    /** 입찰 — 인증 필요. 성공 201 {@code { bidPublicId, amount, currentHighestAmount, endAt }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<BidPlaceResponse> place(
        @PathVariable String auctionPublicId, @Valid @RequestBody BidPlaceRequest request) {
        return ApiResponse.success(BidPlaceResponse.from(bidService.place(request.toCommand(auctionPublicId))));
    }

    /**
     * 입찰 내역 — <b>인증 불요</b>(계약 §3.1, 응답은 닉네임 마스킹). offset 페이지 + 금액 내림차순 고정 정렬이다
     * (정렬 파라미터를 열지 않는다 — 계약이 단일 정렬만 규정하고, 임의 정렬은 인덱스 밖 스캔 표면을 넓힌다).
     *
     * <p>{@code page}·{@code size} 는 서버가 <b>정규화</b>한다. 음수 page 는 {@code PageRequest} 가 예외를
     * 던져 500 이 되고, 무제한 size 는 미인증 요청 하나로 전 이력을 뽑게 하므로 둘 다 경계에서 접는다.
     */
    @GetMapping
    public ApiResponse<BidPageResponse> list(
        @PathVariable String auctionPublicId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), normalizeSize(size));
        return ApiResponse.success(BidPageResponse.from(bidService.getBids(auctionPublicId, pageable)));
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다. */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
