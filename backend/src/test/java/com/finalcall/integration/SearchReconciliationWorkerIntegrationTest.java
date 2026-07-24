package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.io.StringReader;
import java.util.Map;

import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.search.ListingDocument;
import com.finalcall.domain.search.ListingIndexer;
import com.finalcall.domain.search.ListingSearchProperties;
import com.finalcall.domain.search.ListingType;
import com.finalcall.domain.search.SearchReconciliationProperties;
import com.finalcall.domain.search.SearchReconciliationWorker;
import com.finalcall.domain.shop.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Refresh;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * 화해 histogram 드리프트 탐지 검증(search, FC-110 · search-spec §12.5) — 실제 Elasticsearch(Testcontainer) +
 * MySQL(정본)측은 Mockito 스텁.
 *
 * <p>★ 핵심(FC-110 DoD#2): <b>총량은 같은데 상태 분포가 다른</b> 상태전이 드리프트를 실제로 탐지하는지 확인한다 —
 * 종전 총량 count 대조로는 못 잡던 케이스다. ES agg(terms status · histogram price)는 실 Testcontainer 로 결정적으로
 * 돌리고, MySQL 집계는 스텁으로 값을 주입해 드리프트 시나리오를 시딩한다. 관측(DoD#5)은 {@link SimpleMeterRegistry}
 * 로 드리프트 카운터(listingType·status 태그) 증가를 단언한다.
 *
 * <p>Spring 컨텍스트 없이 {@link SearchReconciliationWorker} 를 직접 조립한다(가볍고 빠름). 인덱스는 매 테스트
 * 새로 만들어(화해는 alias 전건을 집계하므로) 격리한다.
 */
@Testcontainers
class SearchReconciliationWorkerIntegrationTest {

    @Container
    static final ElasticsearchContainer ES = new ElasticsearchContainer(
        DockerImageName.parse("docker.elastic.co/elasticsearch/elasticsearch:8.18.8"))
        .withEnv("xpack.security.enabled", "false")
        .withEnv("discovery.type", "single-node")
        .withReuse(true);

    private static final String INDEX = "recon_v1";
    private static final String ALIAS = "recon_search";
    private static final long BUCKET = 1_000_000L;
    private static final String STATUS_DRIFT = "finalcall.search.reconciliation.status_drift";
    private static final String PRICE_DRIFT = "finalcall.search.reconciliation.price_drift";

    private static ElasticsearchClient client;

    private AuctionRepository auctionRepository;
    private ShopRepository shopRepository;
    private SimpleMeterRegistry meterRegistry;
    private SearchReconciliationWorker worker;

    @BeforeAll
    static void connect() {
        RestClient restClient = RestClient.builder(HttpHost.create(ES.getHttpHostAddress())).build();
        ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
        client = new ElasticsearchClient(transport);
    }

    @BeforeEach
    void setUp() throws IOException {
        createIndex();
        auctionRepository = mock(AuctionRepository.class);
        shopRepository = mock(ShopRepository.class);
        ListingIndexer listingIndexer = mock(ListingIndexer.class);
        meterRegistry = new SimpleMeterRegistry();

        // enabled 는 sweepOnce 직접 호출과 무관, correctOnDrift=false 로 보정 재색인은 끈다(탐지·계측만 검증).
        SearchReconciliationProperties properties = new SearchReconciliationProperties(false, 300_000L, false, BUCKET);
        ListingSearchProperties searchProperties = new ListingSearchProperties(ALIAS, 2, 64, false);
        worker = new SearchReconciliationWorker(client, auctionRepository, shopRepository,
            listingIndexer, searchProperties, properties, meterRegistry);

        // SHOP 은 이 테스트들에서 관심 밖 — MySQL·ES 모두 비어 정합(드리프트 노이즈 제거).
        when(shopRepository.count()).thenReturn(0L);
        when(shopRepository.countGroupByStatus()).thenReturn(Map.of());
        when(shopRepository.countGroupByPriceBucket(anyLong())).thenReturn(Map.of());
    }

    @AfterEach
    void tearDown() throws IOException {
        client.indices().delete(delete -> delete.index(INDEX));
    }

    @Test
    void 총량이_같아도_상태분포가_어긋나면_드리프트를_탐지한다() throws IOException {
        // ES: AUCTION ACTIVE 3건(총 3). MySQL: 총 3건이나 ACTIVE 2 + SOLD 1(= 상태전이 드리프트, 총량은 일치).
        indexAuction("A1", "ACTIVE", 100L);
        indexAuction("A2", "ACTIVE", 200L);
        indexAuction("A3", "ACTIVE", 300L);
        when(auctionRepository.count()).thenReturn(3L);
        when(auctionRepository.countGroupByStatus())
            .thenReturn(Map.of(AuctionStatus.ACTIVE, 2L, AuctionStatus.SOLD, 1L));
        when(auctionRepository.countGroupByPriceBucket(anyLong())).thenReturn(Map.of(0L, 3L)); // 전건 버킷0

        boolean drift = worker.sweepOnce();

        assertThat(drift).isTrue();
        assertThat(statusDrift("AUCTION", "ACTIVE")).isEqualTo(1.0); // db 2 ↔ es 3
        assertThat(statusDrift("AUCTION", "SOLD")).isEqualTo(1.0); // db 1 ↔ es 0
        assertThat(priceDrift("AUCTION")).isZero(); // 가격 버킷은 일치
    }

    @Test
    void 총량_상태_가격이_모두_일치하면_드리프트가_없다() throws IOException {
        indexAuction("A1", "ACTIVE", 100L);
        indexAuction("A2", "SOLD", 200L);
        when(auctionRepository.count()).thenReturn(2L);
        when(auctionRepository.countGroupByStatus())
            .thenReturn(Map.of(AuctionStatus.ACTIVE, 1L, AuctionStatus.SOLD, 1L));
        when(auctionRepository.countGroupByPriceBucket(anyLong())).thenReturn(Map.of(0L, 2L));

        boolean drift = worker.sweepOnce();

        assertThat(drift).isFalse();
        assertThat(meterRegistry.find(STATUS_DRIFT).counters()).isEmpty();
        assertThat(meterRegistry.find(PRICE_DRIFT).counters()).isEmpty();
    }

    @Test
    void 상태는_같아도_가격대_분포가_어긋나면_드리프트를_탐지한다() throws IOException {
        // ES: 버킷0(price 100) 1건 + 버킷1_000_000(price 1_500_000) 1건. MySQL: 전건을 버킷0(2건)으로 오집계했다고 가정.
        indexAuction("A1", "ACTIVE", 100L);
        indexAuction("A2", "ACTIVE", 1_500_000L);
        when(auctionRepository.count()).thenReturn(2L);
        when(auctionRepository.countGroupByStatus()).thenReturn(Map.of(AuctionStatus.ACTIVE, 2L)); // 상태·총량 일치
        when(auctionRepository.countGroupByPriceBucket(anyLong())).thenReturn(Map.of(0L, 2L));

        boolean drift = worker.sweepOnce();

        assertThat(drift).isTrue();
        assertThat(statusDrift("AUCTION", "ACTIVE")).isZero(); // 상태 분포는 일치
        assertThat(priceDrift("AUCTION")).isEqualTo(2.0); // 버킷0(db2↔es1)·버킷1M(db0↔es1) 둘 다 어긋남
    }

    // ---------------- helpers ----------------

    private double statusDrift(String listingType, String status) {
        Counter counter = meterRegistry.find(STATUS_DRIFT)
            .tags("listingType", listingType, "status", status).counter();
        return counter == null ? 0.0 : counter.count();
    }

    private double priceDrift(String listingType) {
        Counter counter = meterRegistry.find(PRICE_DRIFT).tags("listingType", listingType).counter();
        return counter == null ? 0.0 : counter.count();
    }

    private void indexAuction(String publicId, String status, long price) throws IOException {
        ListingDocument doc = ListingDocument.builder()
            .listingType(ListingType.AUCTION.name())
            .publicId(publicId)
            .nameSnapshot("집계 아이템")
            .status(status)
            .price(price)
            .createdAt("2026-07-22T00:00:00Z")
            .build();
        client.index(index -> index.index(ALIAS).id(publicId).document(doc).refresh(Refresh.True));
    }

    private static void createIndex() throws IOException {
        // status=keyword·price=long 만 명시 매핑(agg 대상). 나머지는 dynamic. alias 로 질의(화해와 동일 경로).
        String body = """
            {
              "mappings": {
                "properties": {
                  "listingType": { "type": "keyword" },
                  "publicId": { "type": "keyword" },
                  "status": { "type": "keyword" },
                  "price": { "type": "long" }
                }
              },
              "aliases": { "recon_search": {} }
            }
            """;
        client.indices().create(create -> create.index(INDEX).withJson(new StringReader(body)));
    }
}
