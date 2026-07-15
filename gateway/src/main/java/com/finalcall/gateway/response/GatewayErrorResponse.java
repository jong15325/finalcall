package com.finalcall.gateway.response;

import java.time.Instant;

/**
 * 게이트웨이 엣지 오류 응답 envelope(계약 [1.6], D-068).
 *
 * <p>게이트웨이는 서비스의 {@code common.response.ErrorResponse} 에 의존하지 않는다(B-026 독립 2앱,
 * 공유 모듈 미도입). 따라서 계약 [1.6]과 <b>필드명·순서·타입이 정확히 일치</b>하는 동형 DTO 를 자체에 둔다.
 *
 * <p>필드 순서(직렬화 순서 = record 선언 순서): {@code success → code → message → timestamp}.
 * 필드 검증 오류({@code errors})는 서비스 전용이라 엣지 응답에는 포함하지 않는다(계약 [1.6]).
 * {@code timestamp} 는 ISO-8601 UTC({@link Instant}, Boot Jackson 기본 직렬화).
 */
public record GatewayErrorResponse(boolean success, String code, String message, Instant timestamp) {

    /** 엣지 오류 코드·메시지로 생성(success=false, timestamp=현재 UTC). */
    public static GatewayErrorResponse of(String code, String message) {
        return new GatewayErrorResponse(false, code, message, Instant.now());
    }
}
