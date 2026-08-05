package com.finalcall.domain.delivery.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.response.ApiResponse;
import com.finalcall.common.response.CursorResponse;
import com.finalcall.domain.delivery.dto.DeliveryDetailResponse;
import com.finalcall.domain.delivery.dto.DeliverySummaryResponse;
import com.finalcall.domain.delivery.entity.DeliveryStatus;
import com.finalcall.domain.delivery.service.DeliveryQueryService;

import lombok.RequiredArgsConstructor;

/**
 * 구매자 배송 상태 조회 컨트롤러(delivery, FC-192) — 계약 §4.6.1 {@code GET /api/v1/me/deliveries}·
 * {@code GET /api/v1/me/deliveries/{deliveryPublicId}}.
 *
 * <p>{@code me} 접두는 인증 주체(SecurityContext) 기준 리소스다 — 경로에 사용자 식별자를 받지 않아 타인 배송 접근이
 * 불가하다(IDOR 설계 차단). 전부 인증 필요다(SecurityConfig {@code anyRequest().authenticated()} — 화이트리스트 밖,
 * 미인증 401). 요청자는 컨트롤러가 아니라 서비스가 SecurityContext 에서 도출한다(B-009). 반환은 항상
 * {@link ApiResponse}, try-catch 금지(전역 핸들러). {@code status} 필터는 enum 화이트리스트로만 허용한다(임의 값 차단).
 */
@RestController
@RequestMapping("/api/v1/me/deliveries")
@RequiredArgsConstructor
public class DeliveryController {

    /** 페이지 크기 상한. */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 cursor 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final DeliveryQueryService deliveryQueryService;

    /** 내 배송 목록 — 인증 필요. recipient=주체 스코프 + status 필터 + cursor 페이지(created_at desc). */
    @GetMapping
    public ApiResponse<CursorResponse<DeliverySummaryResponse, String>> myDeliveries(
        @RequestParam(required = false) DeliveryStatus status,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(deliveryQueryService.getMyDeliveries(status, cursor, normalizeSize(size)));
    }

    /** 배송 상세 — 인증 필요(당사자만). 미존재·비당사자 모두 404(DELIVERY_001). */
    @GetMapping("/{deliveryPublicId}")
    public ApiResponse<DeliveryDetailResponse> deliveryDetail(@PathVariable String deliveryPublicId) {
        return ApiResponse.success(deliveryQueryService.getMyDelivery(deliveryPublicId));
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다. */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
