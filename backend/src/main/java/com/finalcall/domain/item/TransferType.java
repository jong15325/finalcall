package com.finalcall.domain.item;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 소유 이전 유형(item, erd §4.3, spec §4).
 *
 * <p>EPIC-ITEM 범위에서 실제 사용하는 트리거는 {@link #SEED}(최초 발행) 뿐이다.
 * {@link #TRADE}는 거래(낙찰·구매) 이전으로 sale_order 존재를 전제하므로 auction/order 에픽 소유(G7),
 * {@link #ADMIN_GRANT}는 게이트2에서 MVP 경로 미도입으로 확정 — enum 값만 후속 확장 대비 존치한다.
 */
@Getter
@RequiredArgsConstructor
public enum TransferType {

    TRADE("거래 이전"),
    ADMIN_GRANT("관리자 지급"),
    SEED("최초 발행(시드)");

    private final String description;
}
