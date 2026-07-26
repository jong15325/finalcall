package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.StringReader;
import java.util.List;

import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.domain.search.config.ListingSearchProperties;
import com.finalcall.domain.search.dto.ListingSearchResult;
import com.finalcall.domain.search.entity.ListingDocument;
import com.finalcall.domain.search.entity.ListingSearchCondition;
import com.finalcall.domain.search.entity.ListingType;
import com.finalcall.domain.search.service.ListingIndexer;
import com.finalcall.domain.search.service.ListingSearchService;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.Refresh;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;

/**
 * 검색 질의 통합 검증(search, 계약 C1~C3 · search-spec §12.4·§12.7) — 실제 Elasticsearch(Testcontainer).
 *
 * <p>★ 전체 CDC 스택(Kafka·Connect·Debezium) 통합은 로컬 부담이 커 <b>런북 수동 검증</b>으로 대체하고
 * (docker/search/README.md), 여기서는 <b>색인·검색 쿼리 로직</b>만 ES Testcontainer 로 결정적으로 검증한다(FC-107
 * 지침). nori 플러그인은 이미지에 없으므로 테스트 인덱스는 {@code nori_kr} 자리에 standard 분석기를 매핑하고
 * {@code ngram_kr} 은 실제 ngram 을 쓴다 — 서비스의 질의 구성(multi_match·filter AND·relevance·search_after)은
 * 분석기와 무관하게 동일하다. nori 형태소 정밀도는 런북 스모크에서 확인한다.
 *
 * <p>Spring 컨텍스트·MySQL 없이 {@link ListingSearchService} 를 실제 ES 클라이언트로 직접 조립해(가볍고 빠름)
 * 텍스트 매칭·코드축 AND·리스팅종류 격리·상태 기본 노출·relevance 커서 페이지·{@code q} 규약(길이·빈결과)을 확인한다.
 */
@Testcontainers
class ListingSearchIntegrationTest {

    @Container
    static final ElasticsearchContainer ES = new ElasticsearchContainer(
        DockerImageName.parse("docker.elastic.co/elasticsearch/elasticsearch:8.18.8"))
        .withEnv("xpack.security.enabled", "false")
        .withEnv("discovery.type", "single-node")
        .withReuse(true);

    private static final String INDEX = "listings_v1";
    private static final String ALIAS = "listings_search";

    private static ElasticsearchClient client;
    private static ListingSearchProperties properties;
    private static ListingSearchService service;

    @BeforeAll
    static void setUp() throws IOException {
        RestClient restClient = RestClient.builder(HttpHost.create(ES.getHttpHostAddress())).build();
        ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
        client = new ElasticsearchClient(transport);

        properties = new ListingSearchProperties(ALIAS, 2, 64, false);
        service = new ListingSearchService(client, properties);

        createIndex(client);
        indexFixtures(client);
    }

    // ---------------- 텍스트 매칭 · 상태 기본 노출 ----------------

    @Test
    void q_로_이름을_매칭하고_기본_상태_노출만_반환한다() {
        // "불의 검" ACTIVE 3건(A1·A2·A3) + SOLD 1건(C1, 기본 노출 제외) + 다른 이름(B1) + SHOP(S1, 종류 격리)
        ListingSearchResult result = service.search(auctionCondition("불의", null, null), null, 20);

        assertThat(result.publicIds()).containsExactlyInAnyOrder("A1", "A2", "A3");
        assertThat(result.hasNext()).isFalse();
    }

    @Test
    void 코드축_필터는_q_와_AND_결합된다() {
        // mainCategory=1 인 "불의 검" 은 A1·A3(A2 는 mainCategory=2)
        ListingSearchResult result = service.search(auctionCondition("불의", 1, null), null, 20);

        assertThat(result.publicIds()).containsExactlyInAnyOrder("A1", "A3");
    }

    @Test
    void listingType_이_다르면_격리된다() {
        // 같은 이름의 SHOP 리스팅(S1)은 AUCTION 검색에 나오지 않고, SHOP 검색에만 나온다.
        ListingSearchResult auctionResult = service.search(auctionCondition("불의", null, null), null, 20);
        assertThat(auctionResult.publicIds()).doesNotContain("S1");

        ListingSearchResult shopResult = service.search(
            new ListingSearchCondition(ListingType.SHOP, "불의", null, null, null, null, null, null, null, null,
                null, null, null, List.of("ACTIVE")),
            null, 20);
        assertThat(shopResult.publicIds()).containsExactly("S1");
    }

    // ---------------- relevance 커서 페이지(search_after) ----------------

    @Test
    void relevance_커서로_페이지를_넘겨도_중복_누락이_없다() {
        ListingSearchResult page1 = service.search(auctionCondition("불의", null, null), null, 2);
        assertThat(page1.publicIds()).hasSize(2);
        assertThat(page1.hasNext()).isTrue();
        assertThat(page1.nextCursor()).isNotNull();

        ListingSearchResult page2 = service.search(auctionCondition("불의", null, null), page1.nextCursor(), 2);
        assertThat(page2.hasNext()).isFalse();

        // 두 페이지 합집합 = 전체 3건, 겹침 없음(keyset 안정성).
        assertThat(page1.publicIds()).doesNotContainAnyElementsOf(page2.publicIds());
        assertThat(concat(page1, page2)).containsExactlyInAnyOrder("A1", "A2", "A3");
    }

    // ---------------- q 규약(계약 C3) ----------------

    @Test
    void q_가_최소길이_미만이면_400_COMMON() {
        assertThatThrownBy(() -> service.search(auctionCondition("불", null, null), null, 20))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);
    }

    @Test
    void q_가_최대길이_초과면_400_COMMON() {
        String tooLong = "가".repeat(65);
        assertThatThrownBy(() -> service.search(auctionCondition(tooLong, null, null), null, 20))
            .isInstanceOf(BusinessException.class)
            .extracting(ex -> ((BusinessException)ex).getErrorCode())
            .isEqualTo(CommonErrorCode.INVALID_INPUT);
    }

    @Test
    void 빈_결과는_에러가_아니라_빈_페이지다() {
        ListingSearchResult result = service.search(auctionCondition("존재하지않는아이템", null, null), null, 20);

        assertThat(result.publicIds()).isEmpty();
        assertThat(result.hasNext()).isFalse();
        assertThat(result.nextCursor()).isNull();
    }

    // ---------------- enrichment populator 경로(MAJOR-1) ----------------

    @Test
    void enrichment_populator_bulkUpsert_로_색인한_문서가_q_매칭된다() throws IOException {
        // ★ 부팅 재색인·화해가 실제로 쓰는 write 경로({@link ListingIndexer#bulkUpsert})로 색인해, camelCase 필드 +
        //   listingType 주입 문서가 q 매칭·코드축 필터에 걸리는지 검증한다(리뷰 MAJOR-1: CDC/enrichment 문서가
        //   실제로 검색되는지). ListingDocument 는 ListingIndexer.toDocument 가 생산하는 것과 동일 타입·필드다.
        ListingIndexer indexer = new ListingIndexer(client, null, null, properties);
        indexer.bulkUpsert(List.of(ListingDocument.builder()
            .listingType(ListingType.AUCTION.name())
            .publicId("E1")
            .nameSnapshot("신규 인챈트 대검")
            .specSnapshot("Lv.99")
            .mainCategory("5")
            .status("ACTIVE")
            .createdAt("2026-07-22T00:00:00Z")
            .build()));
        client.indices().refresh(refresh -> refresh.index(ALIAS));

        ListingSearchResult matched = service.search(auctionCondition("인챈트", null, null), null, 20);
        assertThat(matched.publicIds()).contains("E1");

        // 코드축 필터(mainCategory=5)도 enrichment 문서에 걸린다(join 필드가 실제로 채워짐).
        ListingSearchResult filtered = service.search(auctionCondition("인챈트", 5, null), null, 20);
        assertThat(filtered.publicIds()).containsExactly("E1");
    }

    // ---------------- fixtures ----------------

    /** 경매 검색 조건 헬퍼(q + 선택적 mainCategory/maxPrice 필터, 나머지 축은 미필터). */
    private ListingSearchCondition auctionCondition(String query, Integer mainCategory, Long maxPrice) {
        return new ListingSearchCondition(
            ListingType.AUCTION, query, mainCategory, null, null, null, null, null, null, null,
            null, null, maxPrice, List.of("SCHEDULED", "ACTIVE"));
    }

    private static List<String> concat(ListingSearchResult first, ListingSearchResult second) {
        return java.util.stream.Stream.concat(first.publicIds().stream(), second.publicIds().stream()).toList();
    }

    private static void createIndex(ElasticsearchClient client) throws IOException {
        String body = """
            {
              "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                  "tokenizer": {
                    "ngram_tokenizer": { "type": "ngram", "min_gram": 2, "max_gram": 3,
                      "token_chars": ["letter","digit"] }
                  },
                  "analyzer": {
                    "nori_kr": { "type": "standard" },
                    "ngram_kr": { "type": "custom", "tokenizer": "ngram_tokenizer", "filter": ["lowercase"] }
                  }
                }
              },
              "mappings": {
                "properties": {
                  "listingType": { "type": "keyword" },
                  "publicId": { "type": "keyword" },
                  "nameSnapshot": { "type": "text", "analyzer": "nori_kr",
                    "fields": { "ngram": { "type": "text", "analyzer": "ngram_kr" },
                                "keyword": { "type": "keyword", "ignore_above": 256 } } },
                  "specSnapshot": { "type": "text", "analyzer": "nori_kr" },
                  "mainCategory": { "type": "keyword" }, "subGroup": { "type": "keyword" },
                  "element": { "type": "keyword" }, "kind": { "type": "keyword" },
                  "skill1": { "type": "keyword" }, "skill2": { "type": "keyword" },
                  "level": { "type": "integer" }, "price": { "type": "long" },
                  "highestBidAmount": { "type": "long" }, "gfExpireAt": { "type": "date" },
                  "status": { "type": "keyword" }, "sellerNickname": { "type": "keyword" },
                  "endsAt": { "type": "date" }, "createdAt": { "type": "date" }
                }
              },
              "aliases": { "listings_search": {} }
            }
            """;
        client.indices().create(create -> create.index(INDEX).withJson(new StringReader(body)));
    }

    private static void indexFixtures(ElasticsearchClient client) throws IOException {
        List<ListingDocument> docs = List.of(
            auction("A1", "불의 검 +7", "1", "ACTIVE", 50, 1000L),
            auction("A2", "불의 검 +8", "2", "ACTIVE", 60, 2000L),
            auction("A3", "불의 대검 +9", "1", "ACTIVE", 70, 3000L),
            auction("B1", "얼음 지팡이", "1", "ACTIVE", 40, 500L),
            auction("C1", "불의 검 +5", "1", "SOLD", 30, 800L),
            shop("S1", "불의 검 상점판", "1", "ACTIVE", 55, 1500L));

        client.bulk(bulk -> {
            bulk.refresh(Refresh.True);
            for (ListingDocument doc : docs) {
                bulk.operations(operation -> operation.index(index -> index
                    .index(ALIAS).id(doc.publicId()).document(doc)));
            }
            return bulk;
        });
    }

    private static ListingDocument auction(
        String publicId, String name, String mainCategory, String status, int level, long price) {
        return doc(ListingType.AUCTION, publicId, name, mainCategory, status, level, price);
    }

    private static ListingDocument shop(
        String publicId, String name, String mainCategory, String status, int level, long price) {
        return doc(ListingType.SHOP, publicId, name, mainCategory, status, level, price);
    }

    private static ListingDocument doc(
        ListingType type, String publicId, String name, String mainCategory, String status, int level, long price) {
        return ListingDocument.builder()
            .listingType(type.name())
            .publicId(publicId)
            .nameSnapshot(name)
            .specSnapshot("Lv." + level)
            .mainCategory(mainCategory)
            .subGroup("10")
            .element("100")
            .kind("1000")
            .level(level)
            .price(price)
            .status(status)
            .sellerNickname("판매자")
            .createdAt("2026-07-22T00:00:00Z")
            .build();
    }
}
