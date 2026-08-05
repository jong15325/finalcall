package com.finalcall.domain.delivery.service;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.delivery.config.DeliveryWorkerProperties;
import com.finalcall.domain.delivery.entity.ItemDelivery;
import com.finalcall.domain.delivery.repository.ItemDeliveryRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 배송 라이프사이클 워커(delivery, delivery-domain-spec §4·§5.4·§7.1, FC-188) — 웹이 소유하는 배송 쓰기측 배경
 * 작업을 폴링한다. 경매 마감 워커({@code CloseWorker})·고정가 만료 워커({@code ShopExpiryWorker})의 <b>패턴을
 * 재사용</b>(복제 아님)한 별도 워커다.
 *
 * <p>한 tick 에 두 가지를 처리한다: (1) <b>reconcile</b> — APPLIED 관측 후 {@code item_instance} 를 IN_GAME 으로
 * 소유 이동(§6.1), (2) <b>reclaim</b> — 리스 만료 CLAIMED 를 PENDING 으로 재청구(§5.2). reconcile 은 후보 스캔(락
 * 없음) → 배송 1건씩 {@link DeliveryLifecycleService#reconcileOne} 독립 TX 로 처리해 한 건의 실패가 배치를 멈추지
 * 않게 하고, reclaim 은 조건부 벌크 CAS 1회다({@link DeliveryLifecycleService#reclaimExpiredLeases}).
 *
 * <p><b>다중 인스턴스 안전(수평 확장):</b> reconcile 은 {@code markInGameIfInCustody} 조건부 CAS 단일 승자로,
 * reclaim 은 벌크 CAS(WHERE status=CLAIMED)의 행 락 직렬화로 이중 처리를 막는다. 분산락 불요(domain-spec §8 "DB 가
 * 진실"). 배송은 마감보다 시급성이 낮아 기본 주기가 길다(정확성 백스톱 = 게임 접속 시 무조건 우편함 조회 §3.3).
 *
 * <p><b>AOP self-invocation 무관(부록 C):</b> {@code sweepOnce}·{@code reconcileOnce}·{@code reclaimOnce} 자체에는
 * 트랜잭션·프록시 기능이 없고(내부 반복·위임만), 트랜잭션 경계는 {@link DeliveryLifecycleService}(별도 빈, 프록시
 * 경유)에 있다(CloseWorker 선례). {@code enabled=false}(통합 테스트)면 배경 tick 은 즉시 return 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryLifecycleWorker {

    private final ItemDeliveryRepository itemDeliveryRepository;
    private final DeliveryLifecycleService deliveryLifecycleService;
    private final DeliveryWorkerProperties properties;

    /**
     * 폴링 tick(§4). 간격은 {@code delivery.worker.fixed-delay-ms} 로 바인딩한다. {@code enabled=false}(통합 테스트)면
     * 배경 tick 은 즉시 return 하고, 로직은 {@link #reconcileOnce}·{@link #reclaimOnce} 직접 호출로 결정적으로 검증한다.
     */
    @Scheduled(fixedDelayString = "${delivery.worker.fixed-delay-ms:5000}")
    public void sweep() {
        if (!properties.enabled()) {
            return;
        }
        reconcileOnce();
        reclaimOnce();
    }

    /**
     * 한 tick 분량의 APPLIED→IN_GAME reconcile 을 처리한다 — 후보 스캔(락 없음) → 배송 1건씩 독립 TX 소유 이동.
     * 테스트가 결정적 검증을 위해 직접 호출한다. 개별 배송의 실패(정합 위반·인프라 오류)는 그 배송 TX 만 롤백하고
     * 로깅한 뒤 다음으로 넘어간다 — 배치를 멈추지 않으며, 롤백된 배송은 다음 tick 이 재스캔해 자동 재시도한다.
     *
     * @return 이번 tick 에 처리 시도한 APPLIED 배송 수(멱등 skip 포함)
     */
    public int reconcileOnce() {
        List<ItemDelivery> candidates = itemDeliveryRepository
            .findAppliedPendingReconcile(Limit.of(properties.batchSize()));
        int processed = 0;
        for (ItemDelivery delivery : candidates) {
            try {
                deliveryLifecycleService.reconcileOne(delivery.getId());
                processed++;
            } catch (RuntimeException ex) {
                // 개별 배송 실패는 배치를 멈추지 않는다. 다음 tick 재스캔으로 수렴한다(자동 재시도).
                log.error("배송 소유 이동(IN_GAME) 실패 deliveryId={}", delivery.getId(), ex);
            }
        }
        return processed;
    }

    /**
     * 리스 만료 재청구(CLAIMED→PENDING)를 1회 처리한다 — {@code now − lease} 이전에 청구된 CLAIMED 를 벌크 CAS 로
     * 회수한다. 테스트가 결정적 검증을 위해 직접 호출한다. 벌크 UPDATE 라 건별 격리가 불필요하다(단일 CAS 원자).
     *
     * @return 이번 호출에 PENDING 으로 회수된 배송 행 수
     */
    public int reclaimOnce() {
        Instant threshold = Instant.now().minusMillis(properties.leaseTimeoutMs());
        return deliveryLifecycleService.reclaimExpiredLeases(threshold);
    }
}
