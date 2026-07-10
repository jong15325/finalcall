/**
 * 로깅/추적(Stage 4).
 *
 * <p>{@link com.finalcall.common.logging.MdcContextFilter}(traceId→응답헤더, 요청 컨텍스트 MDC),
 * {@link com.finalcall.common.logging.AccessLogFilter}(method/path/status/elapsed 접근 로그),
 * {@link com.finalcall.common.logging.ServiceLog} + {@link com.finalcall.common.logging.ServiceLogAspect}
 * (서비스 메서드 소요시간, slowMs 초과 시 WARN).
 * traceId/spanId 생성·전파는 Micrometer Tracing 이 담당한다(직접 생성하지 않는다).
 */
package com.finalcall.common.logging;
