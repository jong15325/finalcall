package com.finalcall.domain.auction.controller;

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

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.auction.dto.AuctionCancelResponse;
import com.finalcall.domain.auction.dto.AuctionCursorResponse;
import com.finalcall.domain.auction.dto.AuctionDetailResponse;
import com.finalcall.domain.auction.dto.AuctionRegisterRequest;
import com.finalcall.domain.auction.dto.AuctionRegisterResponse;
import com.finalcall.domain.auction.entity.AuctionSearchCondition;
import com.finalcall.domain.auction.entity.AuctionSort;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.service.AuctionService;

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

    /**
     * 경매 목록 — 인증 불요. 공통 목록 필터 + cursor 페이지 + 정렬 화이트리스트. {@code q}(자유문, 계약 C1~C3)가 있으면
     * ES 검색 경로(relevance 랭킹), 없으면 기존 MySQL 목록 경로다. {@code q} 없이 {@code sort=relevance} 는
     * 무의미 요청이라 400({@code COMMON_001})으로 거부한다(계약 C2).
     */
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
        @RequestParam(name = "q", required = false) String query,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String sort) {
        AuctionSearchCondition condition = new AuctionSearchCondition(
            mainCategory, subGroup, element, kind, minLevel, maxLevel, skill1, skill2,
            goldforceActive, minPrice, maxPrice, status, parseSort(sort), parseAscending(sort));
        if (query != null && !query.isBlank()) {
            return ApiResponse.success(
                AuctionCursorResponse.from(auctionService.search(condition, query, cursor, size), Instant.now()));
        }
        if (isRelevance(sort)) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
        return ApiResponse.success(
            AuctionCursorResponse.from(auctionService.getList(condition, cursor, size), Instant.now()));
    }

    /** {@code sort} field 가 relevance 인지(계약 C2 — {@code q} 없이 요청되면 400). */
    private boolean isRelevance(String sort) {
        return sort != null && !sort.isBlank() && "relevance".equalsIgnoreCase(sort.split(",")[0].trim());
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
