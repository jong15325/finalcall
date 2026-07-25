package com.finalcall.domain.shop.service;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.shop.ShopExpiryWorkerProperties;
import com.finalcall.domain.shop.repository.ShopRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 고정가 만료 워커(shop, EPIC-SHOP §4.4) — 판매 기한이 지난 리스팅을 폴링해 EXPIRED 로 전이하는 배경 작업.
 * 경매 마감 워커({@code CloseWorker})의 <b>패턴을 재사용</b>(복제 아님)한 별도 워커다.
 *
 * <p><b>후보 스캔과 실제 전이를 분리</b>한다: {@link #sweepOnce} 가 락 없이 짧게 후보 id 만 뽑고
 * ({@code findExpirableIds}), 전이는 리스팅 1건씩 {@link ShopExpiryService#expireOne} 의 독립 트랜잭션 + 행 락으로
 * 처리한다. 한 리스팅의 실패가 배치 전체를 롤백하지 않고, 락 보유 구간이 1건으로 좁아진다. {@code batchSize} 로 한
 * tick 처리량을 제한해 폭주를 막고, 못 딴 후보는 다음 tick 이 재스캔한다(domain-spec §9 "DB 가 진실").
 *
 * <p><b>다중 인스턴스 안전(수평 확장):</b> 두 워커가 같은 리스팅을 동시에 집어도 {@link ShopExpiryService} 의 행 락
 * 하 재검증 + 종료성 CAS 가 이중 처리를 막는다(S-F). 분산락 불요. 만료는 경매 마감보다 시급성이 낮아 기본 주기가
 * 길다(60초, {@link ShopExpiryWorkerProperties}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ShopExpiryWorker {

    private final ShopRepository shopRepository;
    private final ShopExpiryService shopExpiryService;
    private final ShopExpiryWorkerProperties properties;

    /**
     * 폴링 tick(§4.4). 간격은 {@code shop.expiry.worker.fixed-delay-ms} 로 바인딩한다. {@code enabled=false}(통합
     * 테스트)면 배경 tick 은 즉시 return 하고, 만료 로직은 {@link #sweepOnce} 직접 호출로 결정적으로 검증한다.
     *
     * <p>{@code sweepOnce} 자체에는 트랜잭션·프록시 기능이 없어(내부 반복만) self-invocation 함정과 무관하다 —
     * 트랜잭션 경계는 {@code shopExpiryService.expireOne}(별도 빈)에 있다(CloseWorker 선례).
     */
    @Scheduled(fixedDelayString = "${shop.expiry.worker.fixed-delay-ms:60000}")
    public void sweep() {
        if (!properties.enabled()) {
            return;
        }
        sweepOnce();
    }

    /**
     * 한 tick 분량을 처리한다 — 후보 스캔(락 없음) → 리스팅 1건씩 독립 TX 전이. 테스트가 결정적 검증을 위해 직접
     * 호출한다. 개별 리스팅의 실패(정합 위반·인프라 오류·데드락)는 그 리스팅 TX 만 롤백하고 로깅한 뒤 다음으로
     * 넘어간다 — 배치를 멈추지 않으며, 롤백된 리스팅은 다음 tick 이 재스캔해 자동 재시도한다.
     *
     * @return 이번 tick 에 실제로 만료(EXPIRED)한 리스팅 수
     */
    public int sweepOnce() {
        Instant now = Instant.now();
        List<Long> ids = shopRepository.findExpirableIds(now, PageRequest.of(0, properties.batchSize()));
        int expired = 0;
        for (Long id : ids) {
            try {
                shopExpiryService.expireOne(id, now);
                expired++;
            } catch (RuntimeException ex) {
                // 개별 리스팅 실패는 배치를 멈추지 않는다. 다음 tick 재스캔으로 수렴한다(자동 재시도).
                log.error("고정가 만료 실패 shopId={}", id, ex);
            }
        }
        return expired;
    }
}
