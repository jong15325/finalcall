package com.finalcall.infra.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 스케줄링 활성화 설정(infra, EPIC-CLOSING) — {@code @Scheduled} 배경 작업(경매 마감 워커)을 켠다.
 *
 * <p>tick 활성 여부·간격·배치 크기는 {@code closing.worker.*} 프로퍼티가 제어한다({@code ClosingWorkerProperties}).
 * 통합 테스트는 {@code closing.worker.enabled=false} 로 배경 tick 을 무력화하고 워커 메서드를 직접 호출해 마감을
 * 결정적으로 검증한다(스케줄러 테스트 표준 패턴).
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
