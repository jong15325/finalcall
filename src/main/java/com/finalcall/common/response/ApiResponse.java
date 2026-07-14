package com.finalcall.common.response;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;

import lombok.Getter;

/**
 * 성공 응답 wrapper(Stage 3). <b>성공 전용</b> — 에러 필드(code/message/errors)를 두지 않는다.
 *
 * <p>에러는 별도 타입 {@link ErrorResponse} 로 표현한다(둘을 공통 부모로 묶지 않는다).
 * 생성은 정적 팩토리로만 한다(생성자 private).
 *
 * @param <T> 응답 데이터 타입
 */
@Getter
public class ApiResponse<T> {

    private final boolean success = true;

    /** data 가 null 이어도 JSON 에 "data": null 로 유지한다(생략 금지). */
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private final T data;

    /** 응답 생성 시각(UTC, ISO-8601). */
    private final Instant timestamp;

    private ApiResponse(T data) {
        this.data = data;
        this.timestamp = Instant.now();
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(data);
    }

    public static ApiResponse<Void> success() {
        return new ApiResponse<>(null);
    }
}
