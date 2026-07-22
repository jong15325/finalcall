package com.finalcall.domain.shop;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 고정가 상태(shop FSM, domain-spec §5·erd §4.2·shop-spec §2.1). DB 는 {@code @Enumerated(EnumType.STRING)}으로
 * 이름을 저장한다.
 *
 * <p>등록 즉시 {@link #ACTIVE}(예약 시작 없음, domain-spec §5). 종료 3종({@link #SOLD}·{@link #EXPIRED}·
 * {@link #CANCELLED})은 <b>모두 ACTIVE 에서만 진입</b>하며 상호 배타다(status CAS 단일 승자). 무기한(end_at NULL)
 * 리스팅은 EXPIRED 로 가지 않고 SOLD·CANCELLED 로만 종결된다(shop-spec §2.1).
 */
@Getter
@RequiredArgsConstructor
public enum ShopStatus {

    ACTIVE("판매 중"),
    SOLD("판매됨"),
    EXPIRED("기한 만료"),
    CANCELLED("취소");

    private final String description;
}
