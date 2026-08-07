package com.finalcall.domain.search.service;

import java.io.IOException;
import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.finalcall.domain.search.config.ListingSearchProperties;
import com.finalcall.domain.search.entity.ListingType;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.mapping.Property;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.indices.get_alias.IndexAliases;
import co.elastic.clients.elasticsearch.indices.get_mapping.IndexMappingRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/** 검색 물리 인덱스 생성·검증·alias 원자 전환을 담당한다. */
@Slf4j
@Component
@RequiredArgsConstructor
public class SearchIndexManager {

    private static final String INDEX_PREFIX = "listings_v";

    private final ElasticsearchClient elasticsearchClient;
    private final ListingSearchProperties properties;

    public String createNextIndex() {
        try {
            Set<String> current = aliasTargets();
            int next = current.stream()
                .map(this::version)
                .max(Comparator.naturalOrder())
                .orElse(0) + 1;
            String target = INDEX_PREFIX + next;
            while (indexExists(target)) {
                target = INDEX_PREFIX + ++next;
            }
            String created = target;
            elasticsearchClient.indices().create(create -> create.index(created));
            verifyTemplateApplied(created);
            log.info("검색 재색인 신규 물리 인덱스 생성 target={}", created);
            return created;
        } catch (IOException ex) {
            throw new IllegalStateException("신규 검색 인덱스 생성 실패", ex);
        }
    }

    public void verifyCounts(String targetIndex, SearchIndexCounts expected) {
        long auctions = count(targetIndex, ListingType.AUCTION);
        long shops = count(targetIndex, ListingType.SHOP);
        if (auctions != expected.auctions() || shops != expected.shops()) {
            throw new IllegalStateException("재색인 count 검증 실패 target=" + targetIndex
                + " expected=" + expected + " actual=" + new SearchIndexCounts(auctions, shops));
        }
        log.info("검색 재색인 count 검증 완료 target={} auctions={} shops={}", targetIndex, auctions, shops);
    }

    private void verifyTemplateApplied(String targetIndex) throws IOException {
        Map<String, IndexMappingRecord> mappings = elasticsearchClient
            .indices().getMapping(get -> get.index(targetIndex)).result();
        Map<String, Property> properties = mappings.get(targetIndex)
            .mappings()
            .properties();
        Property name = properties.get("nameSnapshot");
        boolean mappingValid = name != null
            && name.isText()
            && "nori_kr".equals(name.text().analyzer())
            && name.text().fields().containsKey("ngram")
            && name.text().fields().get("ngram").isText()
            && "ngram_kr".equals(name.text().fields().get("ngram").text().analyzer())
            && keywordFieldsValid(properties)
            && properties.get("level") != null && properties.get("level").isInteger()
            && properties.get("price") != null && properties.get("price").isLong()
            && properties.get("gfExpireAt") != null && properties.get("gfExpireAt").isDate();
        if (!mappingValid) {
            throw new IllegalStateException("검색 인덱스 핵심 매핑이 적용되지 않았습니다.");
        }
        var noriAnalysis = elasticsearchClient.indices().analyze(analyze -> analyze
            .index(targetIndex)
            .analyzer("nori_kr")
            .text("메이플스토리 검은 마법사"));
        var ngramAnalysis = elasticsearchClient.indices().analyze(analyze -> analyze
            .index(targetIndex)
            .analyzer("ngram_kr")
            .text("메이플"));
        if (noriAnalysis.tokens().isEmpty() || ngramAnalysis.tokens().size() < 2) {
            throw new IllegalStateException("검색 인덱스 분석기 검증에 실패했습니다.");
        }
    }

    private boolean keywordFieldsValid(Map<String, Property> properties) {
        return java.util.stream.Stream.of("listingType", "publicId", "status", "mainCategory", "subGroup",
            "element", "kind", "skill1", "skill2")
            .allMatch(field -> properties.get(field) != null && properties.get(field).isKeyword());
    }

    public void switchAlias(String targetIndex) {
        try {
            Set<String> oldTargets = aliasTargets();
            elasticsearchClient.indices().updateAliases(update -> {
                oldTargets.forEach(old -> update.actions(action -> action.remove(remove -> remove
                    .index(old).alias(properties.indexAlias()))));
                update.actions(action -> action.add(add -> add.index(targetIndex).alias(properties.indexAlias())));
                return update;
            });
            log.info("검색 alias 원자 전환 완료 alias={} old={} target={}",
                properties.indexAlias(), oldTargets, targetIndex);
        } catch (IOException ex) {
            throw new IllegalStateException("검색 alias 전환 실패", ex);
        }
    }

    Set<String> aliasTargets() throws IOException {
        if (!elasticsearchClient.indices().existsAlias(exists -> exists.name(properties.indexAlias())).value()) {
            return Set.of();
        }
        Map<String, IndexAliases> aliases = elasticsearchClient.indices()
            .getAlias(get -> get.name(properties.indexAlias()))
            .result();
        return aliases.keySet().stream().collect(Collectors.toUnmodifiableSet());
    }

    private long count(String index, ListingType type) {
        Query query = Query.of(q -> q.term(term -> term.field("listingType").value(type.name())));
        try {
            elasticsearchClient.indices().refresh(refresh -> refresh.index(index));
            return elasticsearchClient.count(count -> count.index(index).query(query)).count();
        } catch (IOException ex) {
            throw new IllegalStateException("검색 인덱스 count 실패 index=" + index + " type=" + type, ex);
        }
    }

    private boolean indexExists(String index) throws IOException {
        return elasticsearchClient.indices().exists(exists -> exists.index(index)).value();
    }

    private int version(String index) {
        if (!index.startsWith(INDEX_PREFIX)) {
            return 0;
        }
        try {
            return Integer.parseInt(index.substring(INDEX_PREFIX.length()));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }
}
