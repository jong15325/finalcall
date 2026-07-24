package com.finalcall.domain.search;

import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.shop.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.aggregations.HistogramBucket;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 검색 화해 워커(search, search-spec §12.5). MySQL(정본)↔Elasticsearch(파생)를 listingType 별로 <b>총량 + 상태 분포
 * + 가격 히스토그램</b>까지 주기 대조해 드리프트를 탐지하는 백스톱이다 — CDC 유실·순서역전·커넥터 정지로 ES 가 정본과
 * 어긋나는 것을 잡는다. bid 도메인의 "정합성은 DB" 백스톱과 동형(domain-spec §8·§10).
 *
 * <p><b>ES 는 정본이 아니다</b> — 드리프트는 예외가 아니라 관측 대상이라 탐지 시 경고 로그(어느 status/가격대가
 * 어긋났는지 버킷 단위)를 남기고, {@code correctOnDrift} 가 켜져 있으면 {@link ListingIndexer#reindexAll()} 로 보정한다
 * (§12.5 "직접 bulk upsert"). 화해 실패(ES 미가용 등)는 목록·검색을 죽이지 않는다 — 배경 작업이라 로깅 후 다음 tick 이
 * 재시도한다.
 *
 * <p><b>총량 대조만으로는 상태전이 드리프트를 못 잡는다</b>(예: ACTIVE→SOLD 가 ES 에 반영 안 돼도 총량은 같다). 그래서
 * MySQL {@code GROUP BY status} 와 ES {@code terms} agg(status), MySQL 가격 버킷과 ES {@code histogram} agg(price)를
 * 하한 키로 정렬 대조한다. 드리프트는 {@code finalcall.search.reconciliation.status_drift}(listingType·status 태그)·
 * {@code price_drift}(listingType 태그) 미터로 관측한다(저카디널리티 태그만).
 *
 * <p>{@code sweepOnce} 는 트랜잭션·프록시 기능이 없어(집계 읽기만) self-invocation 함정과 무관하다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchReconciliationWorker {

    /** ES terms agg 버킷 상한(status enum 최대치 여유). 상태값은 저카디널리티라 넉넉히 잡아도 무해하다. */
    private static final int STATUS_TERMS_LIMIT = 50;

    private static final String STATUS_DRIFT_METER = "finalcall.search.reconciliation.status_drift";
    private static final String PRICE_DRIFT_METER = "finalcall.search.reconciliation.price_drift";

    private final ElasticsearchClient elasticsearchClient;
    private final AuctionRepository auctionRepository;
    private final ShopRepository shopRepository;
    private final ListingIndexer listingIndexer;
    private final ListingSearchProperties searchProperties;
    private final SearchReconciliationProperties properties;
    private final MeterRegistry meterRegistry;

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
     * 한 번의 화해를 수행한다 — listingType 별로 MySQL↔ES 의 총량·상태 분포·가격 히스토그램을 대조해 드리프트를
     * 로깅·계측한다. 테스트가 결정적 검증을 위해 직접 호출한다. ES 미가용 등 실패는 배경 작업이라 삼키고 로깅한다
     * (다음 tick 재시도).
     *
     * @return 드리프트가 관측되면 true(총량·상태·가격 중 하나라도 불일치), 정합이면 false
     */
    public boolean sweepOnce() {
        try {
            boolean auctionDrift = reconcile(ListingType.AUCTION,
                auctionRepository.count(),
                toNameKeyed(auctionRepository.countGroupByStatus()),
                auctionRepository.countGroupByPriceBucket(properties.priceBucketSize()));
            boolean shopDrift = reconcile(ListingType.SHOP,
                shopRepository.count(),
                toNameKeyed(shopRepository.countGroupByStatus()),
                shopRepository.countGroupByPriceBucket(properties.priceBucketSize()));
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

    /**
     * listingType 한 종류의 총량·상태·가격 대조. 총량 불일치는 상태 분포 불일치의 상위집합이라 상태 대조가 이를
     * 포함하지만, 총량 diff 는 한 줄 요약 로그로 남긴다(ES 총량 = 상태 버킷 합).
     */
    private boolean reconcile(ListingType type, long dbTotal,
        Map<String, Long> dbByStatus, Map<Long, Long> dbByPriceBucket) {
        Map<String, Long> esByStatus = statusCountsInEs(type);
        long esTotal = esByStatus.values().stream().mapToLong(Long::longValue).sum();
        if (dbTotal != esTotal) {
            log.warn("검색 드리프트(총량) listingType={} db={} es={} diff={}",
                type, dbTotal, esTotal, dbTotal - esTotal);
        }
        boolean statusDrift = compareStatus(type, dbByStatus, esByStatus);
        boolean priceDrift = comparePrice(type, dbByPriceBucket,
            priceBucketCountsInEs(type, properties.priceBucketSize()));
        return dbTotal != esTotal || statusDrift || priceDrift;
    }

    /** 상태 버킷 대조 — 양쪽 키 합집합을 돌며 불일치 status 를 로깅·계측한다(어느 status 가 어긋났는지 버킷 단위). */
    private boolean compareStatus(ListingType type, Map<String, Long> db, Map<String, Long> es) {
        boolean drift = false;
        for (String status : union(db.keySet(), es.keySet())) {
            long dbCount = db.getOrDefault(status, 0L);
            long esCount = es.getOrDefault(status, 0L);
            if (dbCount != esCount) {
                drift = true;
                log.warn("검색 드리프트(status) listingType={} status={} db={} es={} diff={}",
                    type, status, dbCount, esCount, dbCount - esCount);
                Counter.builder(STATUS_DRIFT_METER)
                    .description("MySQL↔ES 상태 분포 드리프트 탐지 건수")
                    .tag("listingType", type.name())
                    .tag("status", status)
                    .register(meterRegistry)
                    .increment();
            }
        }
        return drift;
    }

    /** 가격 버킷 대조 — 하한 키 합집합을 돌며 불일치 가격대를 로깅·계측한다(어느 가격대가 어긋났는지 버킷 단위). */
    private boolean comparePrice(ListingType type, Map<Long, Long> db, Map<Long, Long> es) {
        boolean drift = false;
        long size = properties.priceBucketSize();
        for (Long lower : union(db.keySet(), es.keySet())) {
            long dbCount = db.getOrDefault(lower, 0L);
            long esCount = es.getOrDefault(lower, 0L);
            if (dbCount != esCount) {
                drift = true;
                log.warn("검색 드리프트(price) listingType={} bucket=[{},{}) db={} es={} diff={}",
                    type, lower, lower + size, dbCount, esCount, dbCount - esCount);
                Counter.builder(PRICE_DRIFT_METER)
                    .description("MySQL↔ES 가격 버킷 드리프트 탐지 건수")
                    .tag("listingType", type.name())
                    .register(meterRegistry)
                    .increment();
            }
        }
        return drift;
    }

    /** ES alias 에서 listingType 필터 + {@code terms} agg(status)로 상태별 count 를 읽는다(size 0). */
    private Map<String, Long> statusCountsInEs(ListingType listingType) {
        try {
            SearchResponse<Void> response = elasticsearchClient.search(search -> search
                .index(searchProperties.indexAlias())
                .size(0)
                .query(query -> query.term(term -> term.field("listingType").value(listingType.name())))
                .aggregations("by_status", agg -> agg.terms(terms -> terms
                    .field("status").size(STATUS_TERMS_LIMIT))),
                Void.class);
            Map<String, Long> counts = new HashMap<>();
            for (StringTermsBucket bucket : response.aggregations().get("by_status").sterms().buckets().array()) {
                counts.put(bucket.key().stringValue(), bucket.docCount());
            }
            return counts;
        } catch (Exception ex) {
            throw new IllegalStateException("ES status agg 실패 listingType=" + listingType, ex);
        }
    }

    /** ES alias 에서 listingType 필터 + {@code histogram} agg(price, interval=size)로 가격 버킷 count 를 읽는다(size 0). */
    private Map<Long, Long> priceBucketCountsInEs(ListingType listingType, long bucketSize) {
        try {
            SearchResponse<Void> response = elasticsearchClient.search(search -> search
                .index(searchProperties.indexAlias())
                .size(0)
                .query(query -> query.term(term -> term.field("listingType").value(listingType.name())))
                .aggregations("by_price", agg -> agg.histogram(histogram -> histogram
                    .field("price").interval((double)bucketSize).minDocCount(1))),
                Void.class);
            Map<Long, Long> counts = new HashMap<>();
            for (HistogramBucket bucket : response.aggregations().get("by_price").histogram().buckets().array()) {
                counts.put((long)bucket.key(), bucket.docCount());
            }
            return counts;
        } catch (Exception ex) {
            throw new IllegalStateException("ES price agg 실패 listingType=" + listingType, ex);
        }
    }

    /** enum 키 count 맵을 status 이름 키로 변환한다(ES status keyword 와 정렬해 대조하기 위함). */
    private static Map<String, Long> toNameKeyed(Map<? extends Enum<?>, Long> counts) {
        Map<String, Long> named = new HashMap<>();
        counts.forEach((status, count) -> named.put(status.name(), count));
        return named;
    }

    /** 두 키 집합의 정렬 합집합(결정적 로그 순서). */
    private static <T extends Comparable<T>> TreeSet<T> union(java.util.Set<T> left, java.util.Set<T> right) {
        TreeSet<T> merged = new TreeSet<>(left);
        merged.addAll(right);
        return merged;
    }
}
