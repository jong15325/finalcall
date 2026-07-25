package com.finalcall.domain.shop.controller;

import java.util.Locale;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.response.ApiResponse;
import com.finalcall.domain.shop.dto.MyShopCursorResponse;
import com.finalcall.domain.shop.dto.MyShopSummaryResponse;
import com.finalcall.domain.shop.entity.ShopSort;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.domain.shop.service.ShopService;

import lombok.RequiredArgsConstructor;

/**
 * 내 판매 컨트롤러(shop, EPIC-SHOP-MANAGE) — 계약 §3.2 {@code GET /api/v1/me/shops}(내 판매 목록).
 *
 * <p>{@code me} 접두는 인증 주체(SecurityContext) 기준 리소스다(§4 서두, {@code /me/orders}·{@code /me/inventory}
 * 대칭) — 경로·파라미터로 seller 를 받지 않아 타인 판매목록 조회(IDOR)가 원천 불가하다(B-009). {@code ShopController}
 * 는 클래스 레벨 {@code @RequestMapping("/api/v1/shops")} 라 별도 base 인 {@code /me/shops} 를 이 컨트롤러가 맡는다
 * (OrderController 선례 — 메서드에 전체 경로). 인증 필요다(SecurityConfig anyRequest().authenticated() — 화이트리스트
 * 밖). 판매자는 서비스가 SecurityContext 에서 도출한다. 반환은 항상 {@link ApiResponse}, try-catch 금지(전역 핸들러).
 *
 * <p>status·sort field 는 화이트리스트로만 해석한다(임의 값·SQL 표면적 차단, B-006). 응답은 공개 {@code ShopSummary}
 * 를 오염시키지 않는 별도 {@link MyShopSummaryResponse}(판매자 전용 예상 정산 포함)로 격리한다(shop-spec §10.3).
 */
@RestController
@RequiredArgsConstructor
public class MeShopController {

    /** 페이지 크기 상한. */
    private static final int MAX_PAGE_SIZE = 100;
    /** 페이지 크기 기본값(계약 §1.3 cursor 규약). */
    private static final int DEFAULT_PAGE_SIZE = 20;
    /** 전 상태 조회 센티널(계약 §3.2) — 컨트롤러가 "상태 predicate 없음"으로 매핑한다. enum 은 DB 4값 유지. */
    private static final String STATUS_ALL = "ALL";

    private final ShopService shopService;

    /**
     * 내 판매 목록 — 인증 필요(판매자=주체). status 필터(생략=ACTIVE·ALL=전체) + cursor 페이지 + 정렬 화이트리스트
     * (createdAt·price·endAt, 기본 createdAt desc). content = {@link MyShopSummaryResponse}(예상 정산 포함).
     */
    @GetMapping("/api/v1/me/shops")
    public ApiResponse<MyShopCursorResponse> myShops(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String sort) {
        return ApiResponse.success(MyShopCursorResponse.from(shopService.getMyShops(
            resolveStatus(status), parseSort(sort), parseAscending(sort), cursor, normalizeSize(size))));
    }

    /**
     * status 파라미터를 화이트리스트로 해석한다: 생략=ACTIVE 기본(진행 중 리스팅이 1차 용도), {@code ALL}=전체 이력
     * (센티널 → null 반환, 서비스/repo 가 "상태 predicate 없음"으로 매핑), 그 외=해당 영속 상태. 미허용 값은
     * 400(COMMON_001)으로 막는다.
     */
    private ShopStatus resolveStatus(String status) {
        if (status == null || status.isBlank()) {
            return ShopStatus.ACTIVE;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (STATUS_ALL.equals(normalized)) {
            return null; // ALL 센티널 — 서비스/repo 도달 시 null = 무필터
        }
        try {
            return ShopStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }

    /** {@code sort=<field>,<dir>}의 field 를 화이트리스트 enum 으로 해석한다(미허용·미지정은 기본 createdAt). */
    private ShopSort parseSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return ShopSort.DEFAULT;
        }
        return ShopSort.from(sort.split(",")[0]);
    }

    /**
     * 정렬 방향 — 이 엔드포인트 기본은 <b>내림차순(createdAt desc, 최근 등록 우선, /me/orders 대칭)</b>이다.
     * 명시적 {@code ,asc} 일 때만 오름차순이고 그 외(미지정·bare field·{@code ,desc})는 내림차순이다.
     */
    private boolean parseAscending(String sort) {
        if (sort == null || sort.isBlank()) {
            return false;
        }
        String[] parts = sort.split(",");
        return parts.length >= 2 && parts[1].trim().equalsIgnoreCase("asc");
    }

    /** size 를 1..{@value #MAX_PAGE_SIZE} 로 접는다. 0 이하는 기본값으로 되돌린다(/me/orders 대칭). */
    private int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(size, MAX_PAGE_SIZE);
    }
}
