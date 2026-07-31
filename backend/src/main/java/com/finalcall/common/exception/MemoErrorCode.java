package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 메모(쪽지) 도메인 에러 코드(memo, EPIC-MEMO) — 네이밍 {@code MEMO_{3자리}}(CLAUDE.md §5). 계약 §2.6·§5 등재분과 1:1.
 *
 * <p>code ↔ HTTP status 는 1:1 이다(계약 §5 규칙). 본문 형식·길이 위반은 도메인 코드가 아니라 COMMON 검증 400
 * ({@link CommonErrorCode#INVALID_INPUT})으로 처리한다(memo-domain-spec §9). 배치는 V2 중앙화 규약대로
 * {@code com.finalcall.common.exception}(feature 루트 아님).
 */
@Getter
@RequiredArgsConstructor
public enum MemoErrorCode implements ErrorCode {

    MEMO_RECEIVER_NOT_FOUND("MEMO_001", HttpStatus.NOT_FOUND, "수신자를 찾을 수 없습니다."),
    MEMO_NOT_FOUND("MEMO_002", HttpStatus.NOT_FOUND, "메모를 찾을 수 없습니다."),
    MEMO_NOT_PARTICIPANT("MEMO_003", HttpStatus.FORBIDDEN, "해당 메모에 접근할 수 없습니다."),
    MEMO_SELF_SEND("MEMO_004", HttpStatus.UNPROCESSABLE_ENTITY, "자기 자신에게는 메모를 보낼 수 없습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
