package com.finalcall.domain.shop;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 고정가 만료 워커 폴링 파라미터(shop, shop-spec §4.4·게이트2 C4).
 *
 * <p>만료는 경매 마감(2초, 낙찰자 대기·에스크로 금전)보다 시급성이 낮아(금전 이동·정산 없이 아이템 회수만) 긴
 * 주기로 부하를 아낀다 — 기본 {@code fixedDelayMs=60000}(60초)·{@code batchSize=200}. 운영 튜닝 값이라 설정으로
 * 뺀다({@code ClosingWorkerProperties} 선례). {@code @Scheduled(fixedDelayString)} 이 이 경로를 직접 참조한다.
 *
 * <p>{@code enabled} 는 스케줄 tick 의 실제 처리 여부를 제어한다 — 통합 테스트는 이를 {@code false} 로 내려 배경
 * tick 이 테스트 데이터를 비결정적으로 만료하지 못하게 하고, 만료 로직은 워커 메서드를 직접 호출해 결정적으로
 * 검증한다({@code CloseWorker} 선례). 운영 프로파일은 항상 {@code true} 다.
 */
@Validated
@ConfigurationProperties(prefix = "shop.expiry.worker")
public record ShopExpiryWorkerProperties(

    /** 스케줄 tick 처리 활성 여부. 운영 true, 통합 테스트 false(직접 호출로 결정적 검증). */
    boolean enabled,

    /** 폴링 간격(ms). {@code @Scheduled(fixedDelayString)} 이 참조한다. */
    @Positive long fixedDelayMs,

    /** 한 tick 후보 스캔 상한(LIMIT). tick 지연 시 폭주 방지 — 못 딴 후보는 다음 tick 이 재스캔한다. */
    @Positive int batchSize) {
}
