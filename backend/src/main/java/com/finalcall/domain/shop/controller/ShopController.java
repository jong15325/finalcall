package com.finalcall.domain.shop.controller;

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
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.shop.dto.ShopCancelResponse;
import com.finalcall.domain.shop.dto.ShopDetailResponse;
import com.finalcall.domain.shop.dto.ShopPurchaseResponse;
import com.finalcall.domain.shop.dto.ShopRegisterRequest;
import com.finalcall.domain.shop.dto.ShopRegisterResponse;
import com.finalcall.domain.shop.dto.ShopSummaryResponse;
import com.finalcall.domain.shop.entity.ShopSearchCondition;
import com.finalcall.domain.shop.entity.ShopSort;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.service.ShopPurchaseService;
import com.finalcall.domain.shop.service.ShopService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 고정가 컨트롤러(shop, EPIC-SHOP) — 계약 §3.2 {@code /api/v1/shops}(등록·목록·상세·구매·취소).
 *
 * <p>등록·구매·취소는 인증 필요(판매자/구매자=주체, SecurityConfig anyRequest().authenticated()), 목록·상세는 공개
 * (GET 화이트리스트). 반환은 항상 {@link ApiResponse}, 요청 검증은 {@code @Valid}, try-catch 금지(전역 핸들러).
 * 엔티티→응답 DTO 변환은 api 계층에서 수행한다. status 필터·정렬 field 는 enum 화이트리스트로만 허용한다(임의
 * 컬럼·SQL 표면적 차단, B-006). 주체(판매자·구매자)는 컨트롤러가 아니라 서비스가 SecurityContext 에서 도출한다
 * (B-009, IDOR 차단). 구매·취소는 요청 본문이 없다(금액=서버 shop.price 확정).
 *
 * <p><b>거래내역(SHOP 주문)은 별도 엔드포인트가 없다</b> — 기존 {@code GET /me/orders}(sourceType=SHOP 필터)·
 * {@code GET /orders/{id}}에 자동 유입한다(SaleOrder source_type 제네릭, 역할별 노출·IDOR 재사용, shop-spec §6).
 */
@RestController
@RequestMapping("/api/v1/shops")
@RequiredArgsConstructor
public class ShopController {

    private final ShopService shopService;
    private final ShopPurchaseService shopPurchaseService;

    /** 고정가 등록 — 인증 필요. 성공 201 {@code { shopPublicId, status, endAt }}. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ShopRegisterResponse> register(@Valid @RequestBody ShopRegisterRequest request) {
        return ApiResponse.success(shopService.register(request));
    }

    /**
     * 고정가 목록 — 인증 불요. 공통 필터 + cursor 페이지 + 정렬 화이트리스트(createdAt·price·endAt). {@code q}(자유문,
     * 계약 C1~C3)가 있으면 ES 검색 경로(relevance 랭킹), 없으면 기존 MySQL 목록 경로다. {@code q} 없이
     * {@code sort=relevance} 는 무의미 요청이라 400({@code COMMON_001})으로 거부한다(계약 C2).
     */
    @GetMapping
    public ApiResponse<CursorResponse<ShopSummaryResponse, String>> list(
        @RequestParam(required = false) Integer mainCategory,
        @RequestParam(required = false) Integer subGroup,
        @RequestParam(required = false) Integer element,
        @RequestParam(required = false) Integer kind,
        @RequestParam(required = false) Integer minLevel,
        @RequestParam(required = false) Integer maxLevel,
        @RequestParam(required = false) Long minPrice,
        @RequestParam(required = false) Long maxPrice,
        @RequestParam(required = false) ShopStatus status,
        @RequestParam(name = "q", required = false) String query,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String sort) {
        ShopSearchCondition condition = new ShopSearchCondition(
            mainCategory, subGroup, element, kind, minLevel, maxLevel, minPrice, maxPrice,
            status, parseSort(sort), parseAscending(sort));
        if (query != null && !query.isBlank()) {
            return ApiResponse.success(shopService.search(condition, query, cursor, size));
        }
        if (isRelevance(sort)) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
        return ApiResponse.success(shopService.getList(condition, cursor, size));
    }

    /** {@code sort} field 가 relevance 인지(계약 C2 — {@code q} 없이 요청되면 400). */
    private boolean isRelevance(String sort) {
        return sort != null && !sort.isBlank() && "relevance".equalsIgnoreCase(sort.split(",")[0].trim());
    }

    /** 고정가 상세 — 인증 불요. 없음 404(SHOP_003). 서비스가 판매자 완료 판매 건수까지 채운 DTO 를 반환한다(§11). */
    @GetMapping("/{shopPublicId}")
    public ApiResponse<ShopDetailResponse> detail(@PathVariable String shopPublicId) {
        return ApiResponse.success(shopService.getDetail(shopPublicId));
    }

    /** 고정가 구매 — 인증 필요(구매자=주체). 요청 본문 없음. 성공 201 {@code { orderPublicId, finalPrice }}. */
    @PostMapping("/{shopPublicId}/purchase")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ShopPurchaseResponse> purchase(@PathVariable String shopPublicId) {
        return ApiResponse.success(shopPurchaseService.purchase(shopPublicId));
    }

    /** 판매자 취소 — 인증 필요(본인=주체). 성공 200 {@code { status:"CANCELLED" }}. */
    @PostMapping("/{shopPublicId}/cancel")
    public ApiResponse<ShopCancelResponse> cancel(@PathVariable String shopPublicId) {
        return ApiResponse.success(new ShopCancelResponse(shopService.cancel(shopPublicId).name()));
    }

    /** {@code sort=<field>,<dir>}의 field 를 화이트리스트 enum 으로 해석한다(미허용·미지정은 기본값). */
    private ShopSort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return ShopSort.DEFAULT;
        }
        return ShopSort.from(sort.split(",")[0]);
    }

    /** 정렬 방향 — {@code ,desc}만 내림차순, 그 외(미지정·asc)는 오름차순. */
    private boolean parseAscending(String sort) {
        if (sort == null || sort.isBlank()) {
            return true;
        }
        String[] parts = sort.split(",");
        return parts.length < 2 || !parts[1].trim().equalsIgnoreCase("desc");
    }
}
