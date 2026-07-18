package com.finalcall.domain.item;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 아이템 위치 디스크리미네이터(item, 플래그 B, erd §2·§4.3).
 *
 * <p>단일 진실원으로 상태별 정확히 하나만 참이다(XOR 불변식, spec §3.1):
 * INVENTORY 는 slot_no(0~95) 보유, TEMP 는 temp_storage 행 존재, LISTED 는 활성 리스팅이 참조.
 * 저장은 {@code @Enumerated(EnumType.STRING)} 으로 이름을 저장한다.
 */
@Getter
@RequiredArgsConstructor
public enum ItemLocation {

    INVENTORY("정규 인벤토리"),
    TEMP("임시보관"),
    LISTED("출품(에스크로)");

    private final String description;
}
