package com.finalcall.domain.sample.dto;

/**
 * 샘플 응답 DTO — api 계층 소속.
 *
 * <p>api 의 DTO 와 domain 의 Entity 를 섞지 않는다(Stage 1 규율).
 * 공통 응답 wrapper(ApiResponse)는 Stage 3 에서 도입한다.
 */
public record SampleResponse(String message) {
}
