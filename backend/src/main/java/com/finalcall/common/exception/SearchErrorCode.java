package com.finalcall.common.exception;

import org.springframework.http.HttpStatus;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 검색 도메인 에러 코드(search, EPIC-SEARCH). 네이밍 {@code SEARCH_{3자리}}(CLAUDE.md §5).
 *
 * <p>{@code q} 규약 위반(길이·무 {@code q} relevance)은 <b>공통 검증</b>({@code COMMON_001} 400)으로 처리한다
 * (계약 C2·C3 "400(COMMON 검증)"). 여기에는 검색엔진 계층 고유 오류만 둔다 — ES 는 파생 read-model 이라 장애 시
 * 목록 자체가 실패하지 않도록 호출 측이 처리하되, 질의 실패를 명시적으로 표현할 코드가 필요하다.
 */
@Getter
@RequiredArgsConstructor
public enum SearchErrorCode implements ErrorCode {

    /** 검색엔진 질의 실패(ES 미가용·타임아웃). ES 는 파생 read-model 이라 503 으로 일시 실패를 알린다. */
    SEARCH_ENGINE_UNAVAILABLE("SEARCH_001", HttpStatus.SERVICE_UNAVAILABLE, "검색 기능이 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
