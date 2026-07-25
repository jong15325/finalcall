package com.finalcall.domain.shop.entity;

import java.time.Instant;

/**
 * 고정가 구매 판정에 필요한 shop 값의 스칼라 스냅샷(shop, shop-spec §4.1).
 *
 * <p>엔티티가 아니라 <b>프로젝션</b>인 이유는 즉시구매와 같다: (1) shop 행에 {@code FOR UPDATE} 를 걸 때 연관을
 * {@code s.seller.id}·{@code s.itemInstance.id} 로 읽어 조인을 만들지 않으므로 단일 테이블 잠금이 유지되고, (2) 구매
 * 절차가 잔액 조건부 UPDATE({@code decreaseGameMoney})·정산 recorder 로 영속성 컨텍스트를 clear 하므로(PC clear
 * 함정) 판정 근거를 값으로 복사해 두어야 detach 영향을 받지 않는다.
 *
 * <p>재검증은 {@code sellerId}(자기구매 차단 SHOP_006)·{@code status}·{@code endAt}(live 판정)을, 금전·정산은
 * {@code price}·{@code itemInstanceId} 를 근거로 한다.
 *
 * @param id             고정가 PK
 * @param sellerId       판매자 PK — 자기구매 차단(SHOP_006) 근거
 * @param status         영속 상태 — live 판정(종료 → SHOP_004) 근거
 * @param endAt          판매 기한(nullable, 무기한이면 null) — live 판정(now &lt; endAt) 근거
 * @param price          고정 판매가(= finalPrice)
 * @param itemInstanceId 출품 아이템 PK(구매자 이전 대상)
 */
public record ShopPurchaseContext(
    Long id,
    Long sellerId,
    ShopStatus status,
    Instant endAt,
    long price,
    Long itemInstanceId) {
}
