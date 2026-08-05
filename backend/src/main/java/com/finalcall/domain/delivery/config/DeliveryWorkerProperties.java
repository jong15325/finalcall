package com.finalcall.domain.delivery.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.Positive;

/**
 * 배송 라이프사이클 워커 폴링 파라미터(delivery, delivery-domain-spec §4·§5.4·§7.1, FC-188).
 *
 * <p>웹이 소유하는 배송 쓰기측 배경 작업 두 가지를 한 tick 으로 묶어 부하를 아낀다 — (1) APPLIED→IN_GAME
 * reconciler(게임 apply 성공 관측 후 소유 이동), (2) 리스 만료 재청구 sweeper(CLAIMED→PENDING). 폴링 간격·배치는
 * 운영 부하 트레이드오프라 설정으로 뺀다({@code ClosingWorkerProperties}·{@code ShopExpiryWorkerProperties} 선례).
 * 배송은 마감(2초, 낙찰자 대기·에스크로 금전)보다 시급성이 낮아(정확성 백스톱은 게임 접속 시 무조건 우편함 조회
 * §3.3) 기본 주기가 길다({@code fixedDelayMs=5000}).
 *
 * <p>{@code leaseTimeoutMs} 는 게임이 청구(CLAIMED)한 리스의 유효 기간이다. {@code claimed_at + lease} 를 넘겨도
 * apply/ack 를 못 마친 리스는 게임 크래시로 간주해 PENDING 으로 회수한다(at-least-once 재청구, §5.2). 이중 지급은
 * 게임 {@code user_item.itm_uuid} UK 로 무해화된다(D-E)라 회수는 안전하다.
 *
 * <p>{@code enabled} 는 스케줄 tick 의 실제 처리 여부를 제어한다 — 통합 테스트는 이를 {@code false} 로 내려 배경
 * tick 이 테스트 데이터를 비결정적으로 전이하지 못하게 하고, reconcile·reclaim 로직은 워커 메서드를 직접 호출해
 * 결정적으로 검증한다({@code CloseWorker} 선례). 운영 프로파일은 항상 {@code true} 다.
 */
@Validated
@ConfigurationProperties(prefix = "delivery.worker")
public record DeliveryWorkerProperties(

    /** 스케줄 tick 처리 활성 여부. 운영 true, 통합 테스트 false(직접 호출로 결정적 검증). */
    boolean enabled,

    /** 폴링 간격(ms). {@code @Scheduled(fixedDelayString)} 이 참조한다. */
    @Positive long fixedDelayMs,

    /** 한 tick reconcile 후보 스캔 상한(LIMIT). tick 지연 시 폭주 방지 — 못 딴 후보는 다음 tick 이 재스캔한다. */
    @Positive int batchSize,

    /** 리스 유효 기간(ms). {@code claimed_at + lease} 초과 CLAIMED 는 재청구(PENDING 회수) 대상이다. */
    @Positive long leaseTimeoutMs) {
}
