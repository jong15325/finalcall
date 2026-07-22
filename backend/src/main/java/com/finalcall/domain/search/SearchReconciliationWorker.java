package com.finalcall.domain.search;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.shop.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 검색 화해 워커(search, search-spec §12.5). MySQL(정본)↔Elasticsearch(파생) <b>count 를 listingType 별로 주기 대조</b>
 * 해 드리프트를 탐지하는 백스톱이다 — CDC 유실·순서역전·커넥터 정지로 ES 가 정본과 어긋나는 것을 잡는다. bid 도메인의
 * "정합성은 DB" 백스톱과 동형(domain-spec §8·§10).
 *
 * <p><b>ES 는 정본이 아니다</b> — 드리프트는 예외가 아니라 관측 대상이라 탐지 시 경고 로그를 남기고, {@code correctOnDrift}
 * 가 켜져 있으면 {@link ListingIndexer#reindexAll()} 로 보정한다(§12.5 "직접 bulk upsert"). 화해 실패(ES 미가용 등)는
 * 목록·검색을 죽이지 않는다 — 배경 작업이라 로깅 후 다음 tick 이 재시도한다.
 *
 * <p>{@code sweepOnce} 는 트랜잭션·프록시 기능이 없어(집계 읽기만) self-invocation 함정과 무관하다. count 는 상태별
 * 대조까지 확장 가능하나(§12.5 price histogram), 이번 구현은 listingType 총량 대조로 드리프트 신호를 확보한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchReconciliationWorker {

    private final ElasticsearchClient elasticsearchClient;
    private final AuctionRepository auctionRepository;
    private final ShopRepository shopRepository;
    private final ListingIndexer listingIndexer;
    private final ListingSearchProperties searchProperties;
    private final SearchReconciliationProperties properties;

    /**
     * 화해 tick. 간격은 {@code search.reconciliation.fixed-delay-ms} 로 바인딩한다. {@code enabled=false}(통합 테스트)면
     * 즉시 return 하고, 화해 로직은 {@link #sweepOnce} 직접 호출로 결정적으로 검증한다.
     */
    @Scheduled(fixedDelayString = "${search.reconciliation.fixed-delay-ms:300000}")
    public void sweep() {
        if (!properties.enabled()) {
            return;
        }
        sweepOnce();
    }

    /**
     * 한 번의 화해를 수행한다 — listingType 별 MySQL count 와 ES count 를 대조해 드리프트를 로깅한다. 테스트가 결정적
     * 검증을 위해 직접 호출한다. ES 미가용 등 실패는 배경 작업이라 삼키고 로깅한다(다음 tick 재시도).
     *
     * @return 드리프트가 관측되면 true(총량 불일치), 정합이면 false
     */
    public boolean sweepOnce() {
        try {
            boolean auctionDrift = compare(ListingType.AUCTION, auctionRepository.count());
            boolean shopDrift = compare(ListingType.SHOP, shopRepository.count());
            boolean drift = auctionDrift || shopDrift;
            if (drift && properties.correctOnDrift()) {
                int reindexed = listingIndexer.reindexAll();
                log.warn("검색 화해: 드리프트 보정 재색인 완료 count={}", reindexed);
            }
            return drift;
        } catch (RuntimeException ex) {
            log.error("검색 화해 실패(ES 미가용 가능) — 다음 tick 재시도", ex);
            return false;
        }
    }

    /** listingType 별 MySQL↔ES count 대조. 불일치면 경고 로깅하고 true 를 반환한다. */
    private boolean compare(ListingType listingType, long dbCount) {
        long esCount = countInEs(listingType);
        if (dbCount != esCount) {
            log.warn("검색 드리프트 탐지 listingType={} db={} es={} diff={}",
                listingType, dbCount, esCount, dbCount - esCount);
            return true;
        }
        return false;
    }

    /** ES alias 에서 listingType term count 를 읽는다. */
    private long countInEs(ListingType listingType) {
        try {
            return elasticsearchClient.count(count -> count
                .index(searchProperties.indexAlias())
                .query(query -> query.term(term -> term
                    .field("listingType").value(listingType.name()))))
                .count();
        } catch (Exception ex) {
            throw new IllegalStateException("ES count 실패 listingType=" + listingType, ex);
        }
    }
}
