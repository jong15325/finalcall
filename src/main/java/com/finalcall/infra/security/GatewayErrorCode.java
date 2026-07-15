package com.finalcall.infra.security;

import org.springframework.http.HttpStatus;

import com.finalcall.common.exception.ErrorCode;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 게이트웨이 엣지 발생 에러 코드(계약 [1.6], D-068).
 *
 * <p>엣지 게이트웨이(SCG)가 서비스 도달 전에 반환하는 오류를 위한 코드다. 계약 [1.6]·[5]가 명시하듯
 * {@code GATEWAY_} 프리픽스 코드는 도메인 ErrorCode enum 과 1:1 대상이 아닌 <b>엣지 예외</b>이며,
 * 코드값의 {@code NNN} 은 3자리 시퀀스가 아니라 HTTP status 를 그대로 쓴다(GATEWAY_403 → 403).
 *
 * <p>서비스측 직접접근 차단({@link GatewayAccessFilter})이 반환하는 {@code GATEWAY_403} 은
 * 여기서 정의한다. 공통 {@link com.finalcall.common.exception.CommonErrorCode} 와 도메인 코드는
 * 건드리지 않는다(065 완료 기준: 서비스 envelope 포맷·도메인 ErrorCode 무변경).
 */
@Getter
@RequiredArgsConstructor
public enum GatewayErrorCode implements ErrorCode {

    /** 게이트웨이 미경유 직접접근 차단(X-Gateway-Token 불일치·부재). */
    DIRECT_ACCESS_BLOCKED("GATEWAY_403", HttpStatus.FORBIDDEN, "게이트웨이를 경유하지 않은 직접 접근입니다.");

    private final String code;
    private final HttpStatus status;
    private final String message;
}
