package com.finalcall.domain.settlement;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.logging.ServiceLog;
import com.finalcall.common.util.Preconditions;

import lombok.RequiredArgsConstructor;

/**
 * 거래내역(주문) 조회 서비스(settlement, EPIC-PURCHASE) — {@code GET /me/orders}·{@code GET /orders/{id}}.
 * <b>읽기 전용·스키마 무변경</b>(sale_order 그대로).
 *
 * <h2>인가(IDOR — purchase-spec §5.1)</h2>
 * 주체는 SecurityContext 기준이다(B-009). 목록은 쿼리를 {@code buyer_id = me OR seller_id = me} 로 <b>스코프</b>해
 * 제3자 주문을 애초에 노출하지 않는다({@link SaleOrderRepositoryCustom#findByCursor}). 상세는 public_id 로 조회한 뒤
 * <b>요청자 ∈ {buyer, seller}</b> 를 검증한다 — 아니면 {@code ORDER_002}(403), 미존재면 {@code ORDER_001}(404).
 *
 * <p>클래스 레벨 {@code @Transactional(readOnly = true)}(CLAUDE.md §5) — 조회만 하므로 쓰기 오버라이드가 없다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrderService {

    private final SaleOrderRepository saleOrderRepository;

    /**
     * 내 거래내역(계약 §4.3) — buyer/seller 스코프 + role·sourceType 필터 + cursor 페이지(created_at desc).
     *
     * @param roleFilter 관점 필터(BUYER=구매분·SELLER=판매분·null=양쪽)
     * @param sourceType 출처 필터(null=전체)
     * @param cursorToken 커서 문자열(null=첫 페이지, 손상 시 400)
     * @param size        페이지 크기(호출 측이 경계로 정규화)
     * @return 요청자 PK 를 포함한 커서 페이지(myRole 파생 근거)
     */
    @ServiceLog
    public OrderSlice getMyOrders(OrderRole roleFilter, SaleOrderSourceType sourceType, String cursorToken, int size) {
        Long userId = currentUserId();
        SaleOrderCursor cursor = SaleOrderCursor.decode(cursorToken);
        List<SaleOrder> fetched = saleOrderRepository.findByCursor(userId, roleFilter, sourceType, cursor, size);

        boolean hasNext = fetched.size() > size;
        List<SaleOrder> content = hasNext ? fetched.subList(0, size) : fetched;
        String nextCursor = content.isEmpty() ? null : encodeLast(content);
        return new OrderSlice(content, nextCursor, hasNext, userId);
    }

    /**
     * 주문 상세(계약 §4.3) — public_id 조회 후 당사자 검증(IDOR). ULID 라 403/404 구분의 열거 리스크가 실질 0이므로
     * 계약 기확정대로 미존재는 404, 당사자 아님은 403 을 분리한다.
     *
     * @return 요청자 PK 를 포함한 상세(역할 노출 파생 근거)
     * @throws BusinessException {@code ORDER_001}(404 없음)·{@code ORDER_002}(403 당사자 아님)
     */
    @ServiceLog
    public OrderView getOrderDetail(String orderPublicId) {
        Long userId = currentUserId();
        SaleOrder order = saleOrderRepository.findDetailByPublicId(orderPublicId)
            .orElseThrow(() -> new BusinessException(OrderErrorCode.ORDER_NOT_FOUND));
        Preconditions.validate(isParty(order, userId), OrderErrorCode.ORDER_NOT_PARTY);
        return new OrderView(order, userId);
    }

    /** 요청자가 주문 당사자(buyer 또는 seller)인지. fetch join 으로 초기화된 연관이라 lazy 접근이 아니다. */
    private boolean isParty(SaleOrder order, Long userId) {
        return order.getBuyer().getId().equals(userId) || order.getSeller().getId().equals(userId);
    }

    private String encodeLast(List<SaleOrder> content) {
        SaleOrder last = content.get(content.size() - 1);
        return SaleOrderCursor.encode(last.getCreatedAt(), last.getId());
    }

    /** 인증 주체(내부 PK). {@code /me/orders}·{@code /orders/**} 는 SecurityConfig 가 인증을 강제한다(B-009). */
    private Long currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return Long.parseLong(authentication.getName());
    }
}
