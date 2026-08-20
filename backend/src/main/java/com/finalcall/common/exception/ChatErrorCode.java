package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** 채팅 도메인 오류 코드. API 계약 v1.27 §2.7·§5와 1:1로 대응한다. */
@Getter
@RequiredArgsConstructor
public enum ChatErrorCode implements ErrorCode {

    CHAT_NOT_FOUND("CHAT_001", HttpStatus.NOT_FOUND, "채팅방 또는 메시지를 찾을 수 없습니다."),
    CHAT_COUNTERPART_NOT_FOUND("CHAT_002", HttpStatus.NOT_FOUND, "대화 상대를 찾을 수 없습니다."),
    CHAT_SELF_DIRECT_ROOM("CHAT_003", HttpStatus.UNPROCESSABLE_ENTITY, "자기 자신과 대화할 수 없습니다."),
    CHAT_IDEMPOTENCY_CONFLICT("CHAT_004", HttpStatus.CONFLICT, "같은 메시지 키를 다른 본문에 사용할 수 없습니다."),
    CHAT_UNAVAILABLE("CHAT_005", HttpStatus.CONFLICT, "현재 대화할 수 없는 상태입니다."),
    CHAT_READ_SEQUENCE_INVALID("CHAT_006", HttpStatus.UNPROCESSABLE_ENTITY, "읽음 위치가 채팅방 범위를 벗어났습니다."),
    CHAT_REPORT_TARGET_INVALID("CHAT_007", HttpStatus.UNPROCESSABLE_ENTITY, "신고할 수 없는 메시지입니다."),
    CHAT_REPORT_DUPLICATED("CHAT_008", HttpStatus.CONFLICT, "이미 신고한 메시지입니다."),
    CHAT_RATE_LIMITED("CHAT_009", HttpStatus.TOO_MANY_REQUESTS, "채팅 요청 한도를 초과했습니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
