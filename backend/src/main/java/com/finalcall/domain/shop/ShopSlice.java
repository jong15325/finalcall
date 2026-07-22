package com.finalcall.domain.shop;

import java.util.List;

/**
 * 고정가 목록 커서 슬라이스(shop, 계약 §1.3). 서비스가 다음 커서·hasNext 를 계산해 표현 계층에 전달한다.
 *
 * @param content    현재 페이지 항목(fetch join 으로 item·seller 초기화됨)
 * @param nextCursor 다음 페이지 커서(opaque, 마지막 페이지면 null)
 * @param hasNext    다음 페이지 존재 여부
 */
public record ShopSlice(List<Shop> content, String nextCursor, boolean hasNext) {
}
