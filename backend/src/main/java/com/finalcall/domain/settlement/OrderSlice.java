package com.finalcall.domain.settlement;

import java.util.List;

/**
 * 거래내역 커서 페이지 결과(settlement) — 내용 + 다음 커서 + hasNext + 요청자 PK. 요청자 관점({@code myRole})은
 * 표현 계층이 {@code viewerId} 로 각 주문에서 파생한다(역할 인지 응답, purchase-spec §5.2) — 그래서 신원 해석은
 * 서비스가 단독으로 하고(단일 진실원) 그 결과인 {@code viewerId} 를 함께 실어 보낸다.
 *
 * @param content    이번 페이지의 sale_order 목록(연관 fetch join 완료)
 * @param nextCursor 다음 페이지 커서(마지막 항목 기준). 다음 페이지가 없으면 null
 * @param hasNext    다음 페이지 존재 여부
 * @param viewerId   요청자 PK(각 주문의 myRole·counterparty 파생 기준)
 */
public record OrderSlice(List<SaleOrder> content, String nextCursor, boolean hasNext, Long viewerId) {
}
