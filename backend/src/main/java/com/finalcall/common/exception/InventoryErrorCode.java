package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 인벤토리 도메인 에러 코드(item, FC-022) — 네이밍 {@code INV_{3자리}}(CLAUDE.md §5). 계약 §5 등재분과 정합.
 */
@Getter
@RequiredArgsConstructor
public enum InventoryErrorCode implements ErrorCode {

    INVENTORY_FULL("INV_001", HttpStatus.CONFLICT, "인벤토리가 가득 찼습니다."),
    SLOT_OCCUPIED("INV_002", HttpStatus.CONFLICT, "이미 사용 중인 슬롯입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
