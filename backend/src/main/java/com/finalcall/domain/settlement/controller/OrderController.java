package com.finalcall.domain.settlement.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.settlement.dto.OrderDetailResponse;
import com.finalcall.domain.settlement.dto.OrderSummaryResponse;
import com.finalcall.domain.settlement.entity.OrderRole;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.settlement.service.OrderService;

import lombok.RequiredArgsConstructor;

/**
 * 거래내역(주문) 컨트롤러(order, EPIC-PURCHASE) — 계약 §4.3 {@code GET /api/v1/me/orders}·
 * {@code GET /api/v1/orders/{orderPublicId}}. 두 경로가 서로 다른 base 라 클래스 레벨 {@code @RequestMapping} 없이
 * 메서드에 전체 경로를 둔다.
 *
 * <p>둘 다 인증 필요다(SecurityConfig anyRequest().authenticated() — 화이트리스트 밖). 요청자는 컨트롤러가 아니라
 * 서비스가 SecurityContext 에서 도출한다(B-009, IDOR 차단). 목록은 요청자 스코프(buyer OR seller)로, 상세는 당사자
 * 검증으로 제3자 접근을 막는다. 반환은 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러). {@code role}·
 * {@code sourceType} 필터는 enum 화이트리스트로만 허용한다(임의 값 차단).
 */
@RestController
@RequiredArgsConstructor
public class OrderController {

    /** 페이지 크기 상한. */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 cursor 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final OrderService orderService;

    /** 내 거래내역 — 인증 필요. buyer OR seller 스코프 + role·sourceType 필터 + cursor 페이지(created_at desc). */
    @GetMapping("/api/v1/me/orders")
    public ApiResponse<CursorResponse<OrderSummaryResponse, String>> myOrders(
        @RequestParam(required = false) OrderRole role,
        @RequestParam(required = false) SaleOrderSourceType sourceType,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(orderService.getMyOrders(role, sourceType, cursor, normalizeSize(size)));
    }

    /** 주문 상세 — 인증 필요(당사자만). 없음 404(ORDER_001), 당사자 아님 403(ORDER_002). */
    @GetMapping("/api/v1/orders/{orderPublicId}")
    public ApiResponse<OrderDetailResponse> orderDetail(@PathVariable String orderPublicId) {
        return ApiResponse.success(orderService.getOrderDetail(orderPublicId));
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다. */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
