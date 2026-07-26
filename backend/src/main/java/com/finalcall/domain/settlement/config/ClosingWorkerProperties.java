package com.finalcall.domain.settlement.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 마감 워커 폴링 파라미터(settlement, closing-domain-spec §3.1).
 *
 * <p>{@code fixedDelayMs}(폴링 간격)·{@code batchSize}(한 tick 처리량 상한)는 운영 부하와 마감 지연 허용치의
 * 트레이드오프라 설정으로 뺀다(게이트2 #2 — 튜닝은 backend-impl). {@code @Scheduled} 의 {@code fixedDelayString}
 * 은 이 프로퍼티 경로를 직접 참조한다({@code CloseWorker}).
 *
 * <p>{@code enabled} 는 스케줄 tick 의 실제 처리 여부를 제어한다 — 통합 테스트는 이를 {@code false} 로 내려 배경
 * tick 이 테스트 데이터를 비결정적으로 마감하지 못하게 하고, 마감 로직은 워커 메서드를 직접 호출해 결정적으로
 * 검증한다(스케줄러 테스트 표준 패턴). 운영 프로파일은 항상 {@code true} 다.
 */
@Validated
@ConfigurationProperties(prefix = "closing.worker")
public record ClosingWorkerProperties(

    /** 스케줄 tick 처리 활성 여부. 운영 true, 통합 테스트 false(직접 호출로 결정적 검증). */
    boolean enabled,

    /** 폴링 간격(ms). {@code @Scheduled(fixedDelayString)} 이 참조한다. */
    @Positive long fixedDelayMs,

    /** 한 tick 후보 스캔 상한(LIMIT). tick 지연 시 폭주 방지 — 못 딴 후보는 다음 tick 이 재스캔한다. */
    @Positive int batchSize) {
}
