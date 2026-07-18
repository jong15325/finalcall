package com.finalcall.api.auction;

import java.time.Instant;

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
import com.finalcall.domain.auction.AuctionSearchCondition;
import com.finalcall.domain.auction.AuctionService;
import com.finalcall.domain.auction.AuctionSort;
import com.finalcall.domain.auction.AuctionStatus;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 경매 컨트롤러(auction, EPIC-AUCTION) — 계약 §3.1 {@code /api/v1/auctions}(등록·목록·상세·취소).
 *
 * <p>등록·취소는 인증 필요(판매자=주체, SecurityConfig anyRequest().authenticated()), 목록·상세는 공개(GET 화이트리스트).
 * 반환은 항상 {@link ApiResponse}, 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러). 엔티티→응답 DTO 변환은
 * api 계층에서 수행한다. status 필터·정렬 field 는 enum 화이트리스트로만 허용한다(임의 컬럼·SQL 표면적 차단, B-006).
 */
@RestController
@RequestMapping("/api/v1/auctions")
@RequiredArgsConstructor
public class AuctionController {

    private final AuctionService auctionService;

    /** 경매 등록 — 인증 필요. 성공 201 {@code { auctionPublicId, status, endAt }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuctionRegisterResponse> register(@Valid @RequestBody AuctionRegisterRequest request) {
        return ApiResponse.success(AuctionRegisterResponse.from(auctionService.register(request.toCommand())));
    }

    /** 경매 목록 — 인증 불요. 공통 목록 필터 + cursor 페이지 + 정렬 화이트리스트. */
    @GetMapping
    public ApiResponse<AuctionCursorResponse> list(
        @RequestParam(required = false) Integer mainCategory,
        @RequestParam(required = false) Integer subGroup,
        @RequestParam(required = false) Integer element,
        @RequestParam(required = false) Integer kind,
        @RequestParam(required = false) Integer minLevel,
        @RequestParam(required = false) Integer maxLevel,
        @RequestParam(required = false) Integer skill1,
        @RequestParam(required = false) Integer skill2,
        @RequestParam(required = false) Boolean goldforceActive,
        @RequestParam(required = false) Long minPrice,
        @RequestParam(required = false) Long maxPrice,
        @RequestParam(required = false) AuctionStatus status,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String sort) {
        AuctionSearchCondition condition = new AuctionSearchCondition(
            mainCategory, subGroup, element, kind, minLevel, maxLevel, skill1, skill2,
            goldforceActive, minPrice, maxPrice, status, parseSort(sort), parseAscending(sort));
        return ApiResponse.success(
            AuctionCursorResponse.from(auctionService.getList(condition, cursor, size), Instant.now()));
    }

    /** 경매 상세 — 인증 불요. 없음 404(AUCTION_004). status 는 lazy 활성화 파생. */
    @GetMapping("/{auctionPublicId}")
    public ApiResponse<AuctionDetailResponse> detail(@PathVariable String auctionPublicId) {
        return ApiResponse.success(
            AuctionDetailResponse.from(auctionService.getDetail(auctionPublicId), Instant.now()));
    }

    /** 판매자 취소 — 인증 필요(본인=주체). 성공 200 {@code { status:"CANCELLED" }}. */
    @PostMapping("/{auctionPublicId}/cancel")
    public ApiResponse<AuctionCancelResponse> cancel(@PathVariable String auctionPublicId) {
        return ApiResponse.success(new AuctionCancelResponse(auctionService.cancel(auctionPublicId).name()));
    }

    /** {@code sort=<field>,<dir>}의 field 를 화이트리스트 enum 으로 해석한다(미허용·미지정은 기본값). */
    private AuctionSort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return AuctionSort.DEFAULT;
        }
        return AuctionSort.from(sort.split(",")[0]);
    }

    /** 정렬 방향 — {@code ,desc} 만 내림차순, 그 외(미지정·asc)는 오름차순(기본 마감 임박 순). */
    private boolean parseAscending(String sort) {
        if (sort == null || sort.isBlank()) {
            return true;
        }
        String[] parts = sort.split(",");
        return parts.length < 2 || !parts[1].trim().equalsIgnoreCase("desc");
    }
}
