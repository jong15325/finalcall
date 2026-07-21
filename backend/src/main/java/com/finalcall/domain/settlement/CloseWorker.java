package com.finalcall.domain.settlement;

import java.time.Instant;
import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.auction.AuctionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 경매 마감 워커(settlement, EPIC-CLOSING §3.1) — 마감 시각이 지난 경매를 폴링해 종료 상태로 전이하는 배경 작업.
 *
 * <p><b>후보 스캔과 실제 전이를 분리</b>한다: {@link #sweepOnce} 가 락 없이 짧게 후보 id 만 뽑고
 * ({@code findClosableIds}), 전이는 경매 1건씩 {@link CloseService#closeOne} 의 독립 트랜잭션 + 행 락으로 처리한다.
 * 한 경매의 실패가 배치 전체를 롤백하지 않고, 락 보유 구간이 경매 1건으로 좁아진다. {@code batchSize} 로 한 tick
 * 처리량을 제한해 tick 지연 시 폭주를 막고, 못 딴 후보는 다음 tick 이 재스캔한다(domain-spec §9 "DB 가 진실").
 *
 * <p><b>다중 인스턴스 안전(수평 확장):</b> 두 워커가 같은 경매를 동시에 집어도 {@link CloseService} 의 행 락 하
 * 재검증 + 종료성 CAS 가 이중 처리를 막는다(I-F). 분산락(Redisson) 불요 — watchdog 없는 임대 배제(§3.4).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CloseWorker {

    private final AuctionRepository auctionRepository;
    private final CloseService closeService;
    private final ClosingWorkerProperties properties;

    /**
     * 폴링 tick(§3.1). 간격은 {@code closing.worker.fixed-delay-ms} 로 바인딩한다. {@code enabled=false}(통합 테스트)면
     * 배경 tick 은 즉시 return 하고, 마감 로직은 {@link #sweepOnce} 직접 호출로 결정적으로 검증한다.
     *
     * <p>{@code @Scheduled} 는 프록시 경유 진입점이라 {@link #sweepOnce} 를 <b>외부에서</b> 호출하는 셈이 아니라
     * 같은 클래스 메서드를 부르지만, {@code sweepOnce} 자체에 트랜잭션·프록시 기능이 없어(내부 반복만) 문제되지
     * 않는다 — 트랜잭션 경계는 {@code closeService.closeOne}(별도 빈)에 있다(AOP self-invocation 함정 무관).
     */
    @Scheduled(fixedDelayString = "${closing.worker.fixed-delay-ms:2000}")
    public void sweep() {
        if (!properties.enabled()) {
            return;
        }
        sweepOnce();
    }

    /**
     * 한 tick 분량을 처리한다 — 후보 스캔(락 없음) → 경매 1건씩 독립 TX 전이. 테스트가 결정적 검증을 위해 직접
     * 호출한다. 개별 경매의 실패(정합 위반·인프라 오류·데드락)는 그 경매 TX 만 롤백하고 로깅한 뒤 다음 경매로
     * 넘어간다 — 배치 전체를 멈추지 않으며, 롤백된 경매는 다음 tick 이 재스캔해 자동 재시도한다(§3.4).
     *
     * @return 이번 tick 에 실제로 종결(SOLD/UNSOLD)한 경매 수
     */
    public int sweepOnce() {
        Instant now = Instant.now();
        List<Long> ids = auctionRepository.findClosableIds(now, PageRequest.of(0, properties.batchSize()));
        int closed = 0;
        for (Long id : ids) {
            try {
                closeService.closeOne(id, now);
                closed++;
            } catch (RuntimeException ex) {
                // 개별 경매 실패는 배치를 멈추지 않는다. 다음 tick 재스캔으로 수렴한다(자동 재시도).
                log.error("경매 마감 실패 auctionId={}", id, ex);
            }
        }
        return closed;
    }
}
