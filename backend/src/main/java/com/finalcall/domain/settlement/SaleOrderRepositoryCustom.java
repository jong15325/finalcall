package com.finalcall.domain.settlement;

import java.util.List;
import java.util.Optional;

/**
 * 거래내역 커스텀 쿼리 계약(settlement, QueryDSL 구현은 {@link SaleOrderRepositoryImpl}). 목록·상세 응답은 상대
 * 마스킹(buyer·seller nickname)과 item 표시 블록(item_instance·template·skill)을 함께 노출하므로 to-one fetch join
 * 으로 N+1 을 제거한다(OSIV off 전제 — 표현 계층 lazy 접근 불가).
 */
public interface SaleOrderRepositoryCustom {

    /**
     * 내 거래내역(계약 §4.3 {@code GET /me/orders}) — <b>{@code buyer_id = me OR seller_id = me}</b> 로 스코프한다
     * (제3자 주문 미노출, IDOR B1). {@code roleFilter}·{@code sourceType} 은 그 안에서 한 축으로 좁힌다. keyset
     * cursor(created_at desc, id desc)로 안정 페이지네이션하며 hasNext 판단을 위해 {@code size + 1}건 조회한다.
     *
     * @param userId     요청자 PK(SecurityContext 주체)
     * @param roleFilter {@code BUYER}=구매분만·{@code SELLER}=판매분만, null=양쪽(buyer OR seller)
     * @param sourceType 출처 필터(null=전체)
     * @param cursor     페이지 경계
     * @param size       페이지 크기(내부에서 +1 조회)
     * @return 조건에 맞는 sale_order 목록(연관 fetch join, created_at 내림차순)
     */
    List<SaleOrder> findByCursor(
        Long userId, OrderRole roleFilter, SaleOrderSourceType sourceType, SaleOrderCursor cursor, int size);

    /**
     * 주문 상세(계약 §4.3 {@code GET /orders/{id}}) — public_id 로 조회한다. 연관(buyer·seller·item·template·skill)을
     * fetch join 해 마스킹·item 블록·역할 노출에 필요한 값을 한 번에 싣는다. IDOR 검증(당사자만)은 호출 측이
     * 요청자 PK 로 수행한다({@link OrderService}).
     */
    Optional<SaleOrder> findDetailByPublicId(String publicId);
}
