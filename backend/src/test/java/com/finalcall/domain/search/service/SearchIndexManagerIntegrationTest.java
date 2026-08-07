package com.finalcall.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;

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

import com.finalcall.domain.search.config.ListingSearchProperties;
import com.finalcall.domain.search.config.SearchReindexProperties;
import com.finalcall.domain.search.entity.ListingDocument;
import com.finalcall.domain.search.entity.ListingType;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;

@Testcontainers
class SearchIndexManagerIntegrationTest {

    @Container
    static final ElasticsearchContainer ES = new ElasticsearchContainer(
        DockerImageName.parse("finalcall-elasticsearch-nori:8.18.8")
            .asCompatibleSubstituteFor("docker.elastic.co/elasticsearch/elasticsearch"))
        .withEnv("xpack.security.enabled", "false")
        .withEnv("discovery.type", "single-node")
        .withReuse(true);

    private static final String ALIAS = "listings_search_manager_test";
    private static final String OLD = "listings_v901";
    private static final String TARGET = "listings_v902";
    private static final String NEXT = "listings_v903";
    private static final String TEMPLATE = "listings-manager-test";

    private static ElasticsearchClient client;

    private SearchIndexManager manager;

    @BeforeAll
    static void connect() {
        RestClient restClient = RestClient.builder(HttpHost.create(ES.getHttpHostAddress())).build();
        ElasticsearchTransport transport = new RestClientTransport(restClient, new JacksonJsonpMapper());
        client = new ElasticsearchClient(transport);
    }

    @BeforeEach
    void setUp() throws IOException {
        putTemplate();
        client.indices().create(create -> create.index(OLD).aliases(ALIAS, alias -> alias));
        client.indices().create(create -> create.index(TARGET));
        manager = new SearchIndexManager(client, new ListingSearchProperties(ALIAS, 2, 64, false),
            new SearchReindexProperties(60));
    }

    @AfterEach
    void tearDown() throws IOException {
        client.indices().delete(delete -> delete.index(OLD, TARGET, NEXT).ignoreUnavailable(true));
        if (client.indices().existsIndexTemplate(exists -> exists.name(TEMPLATE)).value()) {
            client.indices().deleteIndexTemplate(delete -> delete.name(TEMPLATE));
        }
    }

    @Test
    void count를_검증한_뒤_alias를_원자_전환하고_구_인덱스를_보존한다() throws IOException {
        index(TARGET, "A1", ListingType.AUCTION);
        index(TARGET, "S1", ListingType.SHOP);
        client.indices().refresh(refresh -> refresh.index(TARGET));

        manager.verifyCounts(TARGET, new SearchIndexCounts(1, 1));
        manager.switchAlias(TARGET);

        assertThat(manager.aliasTargets()).containsExactly(TARGET);
        assertThat(client.indices().exists(exists -> exists.index(OLD)).value()).isTrue();
    }

    @Test
    void 구_인덱스는_보존기간_전에는_유지하고_만료_후에만_정리한다() throws IOException {
        manager.switchAlias(TARGET);
        java.time.Instant switchedAt = java.time.Instant.now();

        assertThat(manager.cleanupExpiredOldIndices(switchedAt.plusSeconds(59 * 60))).isZero();
        assertThat(client.indices().exists(exists -> exists.index(OLD)).value()).isTrue();

        assertThat(manager.cleanupExpiredOldIndices(switchedAt.plusSeconds(61 * 60))).isEqualTo(1);
        assertThat(client.indices().exists(exists -> exists.index(OLD)).value()).isFalse();
        assertThat(manager.aliasTargets()).containsExactly(TARGET);
    }

    @Test
    void 재활성화된_인덱스를_다시_retire하면_최신_시각부터_보존하고_현재_대상은_삭제하지_않는다() throws Exception {
        manager.switchAlias(TARGET); // v1 -> v2, v1 최초 retire
        Thread.sleep(5L);
        manager.switchAlias(OLD); // rollback v2 -> v1
        client.indices().create(create -> create.index(NEXT));
        java.time.Instant beforeLatestRetire = java.time.Instant.now();
        Thread.sleep(5L);
        manager.switchAlias(NEXT); // v1 -> v3, v1 재-retire

        var oldAliases = client.indices().getAlias(get -> get.index(OLD)).result().get(OLD).aliases().keySet();
        assertThat(oldAliases.stream().filter(alias -> alias.startsWith("listings_retired_")).toList())
            .hasSize(1);

        SearchIndexManager zeroRetention = new SearchIndexManager(client,
            new ListingSearchProperties(ALIAS, 2, 64, false), new SearchReindexProperties(0));
        assertThat(zeroRetention.cleanupExpiredOldIndices(beforeLatestRetire)).isEqualTo(1); // v2만 만료
        assertThat(client.indices().exists(exists -> exists.index(OLD)).value()).isTrue();
        assertThat(zeroRetention.aliasTargets()).containsExactly(NEXT);

        zeroRetention.cleanupExpiredOldIndices(java.time.Instant.now().plusSeconds(1));
        assertThat(client.indices().exists(exists -> exists.index(OLD)).value()).isFalse();
        assertThat(client.indices().exists(exists -> exists.index(NEXT)).value()).isTrue();
        assertThat(zeroRetention.aliasTargets()).containsExactly(NEXT);
    }

    @Test
    void 실제_템플릿의_분석기와_핵심_매핑이_신규_인덱스에_적용된다() {
        assertThat(manager.createNextIndex()).isEqualTo(NEXT);
    }

    @Test
    void 템플릿이_누락되면_신규_인덱스를_거부하고_alias는_불변이다() throws IOException {
        client.indices().deleteIndexTemplate(delete -> delete.name(TEMPLATE));

        org.assertj.core.api.Assertions.assertThatThrownBy(manager::createNextIndex)
            .isInstanceOf(IllegalStateException.class);
        assertThat(manager.aliasTargets()).containsExactly(OLD);
    }

    @Test
    void ngram_서브필드가_오염되면_alias는_불변이다() throws IOException {
        replaceTemplate(body -> body.replace(
            "\"ngram\": { \"type\": \"text\", \"analyzer\": \"ngram_kr\" }",
            "\"ngram\": { \"type\": \"keyword\" }"));

        org.assertj.core.api.Assertions.assertThatThrownBy(manager::createNextIndex)
            .isInstanceOf(IllegalStateException.class);
        assertThat(manager.aliasTargets()).containsExactly(OLD);
    }

    @Test
    void 주요_정렬_필드_타입이_오염되면_alias는_불변이다() throws IOException {
        replaceTemplate(body -> body.replace(
            "\"publicId\": { \"type\": \"keyword\" }",
            "\"publicId\": { \"type\": \"text\" }"));

        org.assertj.core.api.Assertions.assertThatThrownBy(manager::createNextIndex)
            .isInstanceOf(IllegalStateException.class);
        assertThat(manager.aliasTargets()).containsExactly(OLD);
    }

    private void index(String index, String id, ListingType type) throws IOException {
        ListingDocument document = ListingDocument.builder()
            .publicId(id)
            .listingType(type.name())
            .price(1L)
            .status("ACTIVE")
            .build();
        client.index(request -> request.index(index).id(id).document(document));
    }

    private void putTemplate() throws IOException {
        String body = Files.readString(Path.of("docker/search/listings-template.json"));
        client.indices().putIndexTemplate(put -> put.name(TEMPLATE).withJson(new StringReader(body)));
    }

    private void replaceTemplate(java.util.function.UnaryOperator<String> corruptor) throws IOException {
        client.indices().deleteIndexTemplate(delete -> delete.name(TEMPLATE));
        String source = Files.readString(Path.of("docker/search/listings-template.json"));
        String corrupted = corruptor.apply(source);
        assertThat(corrupted).isNotEqualTo(source);
        client.indices().putIndexTemplate(put -> put.name(TEMPLATE).withJson(new StringReader(corrupted)));
    }
}
