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
        manager = new SearchIndexManager(client, new ListingSearchProperties(ALIAS, 2, 64, false));
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
