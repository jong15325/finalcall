package com.finalcall.domain.item.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 아이템 위치 디스크리미네이터(item, 플래그 B, erd §2·§4.3).
 *
 * <p>단일 진실원으로 상태별 정확히 하나만 참이다(XOR 불변식, spec §3.1):
 * INVENTORY 는 slot_no(0~95) 보유, TEMP 는 temp_storage 행 존재, LISTED 는 활성 리스팅이 참조,
 * IN_GAME 은 게임 인벤토리로 이관 완료(웹 커스터디 이탈). 저장은 {@code @Enumerated(EnumType.STRING)} 으로 이름을 저장한다.
 *
 * <p>{@link #IN_GAME} 은 배송(item_delivery) APPLIED 관측 후 웹 reconciler 가 전이시킨다(EPIC-ITEM-DELIVERY,
 * delivery-domain-spec §5.4·§6.1·§9.2, 게이트2 형상 (a) — 별도 상태축 기각). XOR 연장: IN_GAME ⇒ slot_no NULL ·
 * temp_storage 행 없음 · 활성 리스팅 없음 · 게임 user_item 에 재료화 존재(item_uuid 1:1). 출품 CAS
 * {@code markListedIfInInventory}({@code WHERE location='INVENTORY'})가 IN_GAME 을 자동 배제해 재판매가 차단된다.
 * DB 는 VARCHAR(20)이라 값 추가에 DDL 변경이 없다(V21 주).
 */
@Getter
@RequiredArgsConstructor
public enum ItemLocation {

    INVENTORY("정규 인벤토리"),
    TEMP("임시보관"),
    LISTED("출품(에스크로)"),
    IN_GAME("게임 이관 완료");

    private final String description;
}
