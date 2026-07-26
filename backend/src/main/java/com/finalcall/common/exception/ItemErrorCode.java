package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 아이템 도메인 에러 코드(item, FC-021) — 네이밍 {@code ITEM_{3자리}}(CLAUDE.md §5).
 *
 * <p>ITEM_001·002 는 계약 §5 등재분이다. ITEM_003(relocate 대상 위치 불일치)은 계약 미등재이며 spec §6 이
 * "계약에 등재 권고(총괄 판단)"로 남긴 신설 코드다 — 본 구현은 프론트 분기 명확성을 위해 코드를 두되,
 * 계약 §5 반영은 게이트2 절차로 상신 대상이다(반환 노트 참조).
 */
@Getter
@RequiredArgsConstructor
public enum ItemErrorCode implements ErrorCode {

    ITEM_NOT_FOUND("ITEM_001", HttpStatus.NOT_FOUND, "아이템을 찾을 수 없습니다."),
    ITEM_NOT_OWNER("ITEM_002", HttpStatus.FORBIDDEN, "아이템의 소유자가 아닙니다."),
    ITEM_NOT_IN_TEMP("ITEM_003", HttpStatus.CONFLICT, "임시보관 상태의 아이템이 아닙니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
