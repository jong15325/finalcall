package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 고정가 도메인 에러 코드(shop, EPIC-SHOP) — 네이밍 {@code SHOP_{3자리}}(CLAUDE.md §5). 계약 §5 등재분과 1:1.
 *
 * <p>{@link #SHOP_ITEM_NOT_SELLABLE}(SHOP_001)은 <b>403 단일</b>이다(shop-spec §6·게이트2, SEC-007 열거 방지) —
 * 미소유·미보유(TEMP)·미존재를 통일하고, 상태 충돌인 "이미 출품중"(LISTED)만 {@link #SHOP_ALREADY_LISTED}(409)로
 * 분리한다(AUCTION_001 선례). {@link #SHOP_ALREADY_SOLD_OR_CLOSED}(SHOP_004)는 구매·취소 공통이며 라벨에
 * SOLD·EXPIRED·CANCELLED 를 포함한다(shop-spec §6). {@link #SHOP_SELF_PURCHASE}(SHOP_006)는 wash trade 차단
 * (SEC-003, AUCTION_009 대칭)이다.
 */
@Getter
@RequiredArgsConstructor
public enum ShopErrorCode implements ErrorCode {

    SHOP_ITEM_NOT_SELLABLE("SHOP_001", HttpStatus.FORBIDDEN, "출품할 수 없는 아이템입니다."),
    SHOP_ALREADY_LISTED("SHOP_002", HttpStatus.CONFLICT, "이미 출품 중인 아이템입니다."),
    SHOP_NOT_FOUND("SHOP_003", HttpStatus.NOT_FOUND, "고정가 판매를 찾을 수 없습니다."),
    SHOP_ALREADY_SOLD_OR_CLOSED("SHOP_004", HttpStatus.CONFLICT, "이미 판매되었거나 종료된 고정가입니다."),
    SHOP_INSUFFICIENT_BALANCE("SHOP_005", HttpStatus.UNPROCESSABLE_ENTITY, "게임머니 잔액이 부족합니다."),
    SHOP_SELF_PURCHASE("SHOP_006", HttpStatus.FORBIDDEN, "판매자는 자신의 고정가를 구매할 수 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
