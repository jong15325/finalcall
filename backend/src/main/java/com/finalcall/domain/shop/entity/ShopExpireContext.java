package com.finalcall.domain.shop.entity;

import java.time.Instant;

/**
 * 고정가 만료 판정에 필요한 shop 값의 스칼라 스냅샷(shop, shop-spec §4.4).
 *
 * <p>만료 절차는 잔액 이동이 없어 PC clear 함정은 없지만, 구매·마감 프로젝션과 동형으로 <b>스칼라 프로젝션</b>을
 * 쓴다 — shop 행에 {@code FOR UPDATE} 를 걸 때 연관을 {@code s.itemInstance.id} 로 읽어 조인을 만들지 않으므로
 * 단일 테이블 잠금이 유지된다. 재검증은 {@code status}·{@code endAt}(만료 가능 판정)을, 아이템 회수는
 * {@code itemInstanceId} 를 근거로 한다.
 *
 * @param id             고정가 PK
 * @param status         영속 상태 — 만료 가능 판정(ACTIVE) 근거
 * @param endAt          판매 기한(nullable) — 만료 가능 판정(end_at != null &amp;&amp; end_at &lt;= now) 근거
 * @param itemInstanceId 출품 아이템 PK(TEMP 회수 대상)
 */
public record ShopExpireContext(
    Long id,
    ShopStatus status,
    Instant endAt,
    Long itemInstanceId) {
}
