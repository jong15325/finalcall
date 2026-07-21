package com.finalcall.domain.settlement;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 판매 성립 거래의 출처 유형(settlement, erd §4.2). DB 는 {@code @Enumerated(EnumType.STRING)}으로 이름을 저장한다.
 *
 * <p>{@code source_type + source_id} 폴리모픽 참조로 경매 낙찰({@link #AUCTION})과 shop 구매({@link #SHOP})를
 * 한 테이블로 수렴시킨다(sale_order §5 구매 경로 단일화). <b>EPIC-CLOSING 코어는 {@link #AUCTION} 만 기록</b>하며
 * SHOP 은 후속 에픽(EPIC-SHOP) 소유다 — enum 값만 두어 후속 값 마이그레이션을 피한다.
 */
@Getter
@RequiredArgsConstructor
public enum SaleOrderSourceType {

    AUCTION("경매"),
    SHOP("고정가");

    private final String description;
}
