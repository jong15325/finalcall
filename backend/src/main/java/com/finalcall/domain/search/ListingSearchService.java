package com.finalcall.domain.search;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.finalcall.common.exception.BusinessException;
import com.finalcall.common.exception.CommonErrorCode;
import com.finalcall.common.logging.ServiceLog;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import lombok.RequiredArgsConstructor;

/**
 * 리스팅 검색 서비스(search, 계약 C1~C3 · search-spec §12.4·§12.6·§12.7). {@code q}(자유문)로 {@code listings} alias 를
 * 질의해 <b>매칭·랭킹·커서만</b> 산출한다 — 표시 데이터는 호출 측이 MySQL(정본)에서 하이드레이션한다(§12.8).
 *
 * <p><b>질의 구성:</b> {@code q} 는 {@code multi_match}(nameSnapshot^3 nori 정밀 + nameSnapshot.ngram^1 재현 폴백)로
 * query context, 코드축·범위·상태는 filter context 로 AND 결합한다(계약 C1). <b>{@code match}/{@code multi_match}
 * (분석 쿼리)만 쓰고 {@code query_string} DSL 을 쓰지 않으므로</b> 사용자 입력이 질의 문법으로 해석되지 않는다 —
 * 이스케이프 불요·DSL 인젝션 원천 차단(계약 C3).
 *
 * <p><b>랭킹·커서:</b> {@code relevance} = {@code _score desc}, 타이브레이커 {@code publicId asc}. 커서는
 * {@code search_after(_score, publicId)} keyset 이라 삽입 중에도 페이지 경계가 흔들리지 않는다. 문서 {@code _id} =
 * {@code publicId} 라 {@code _source} 를 받지 않고 {@code hit.id()} 만 읽는다(네트워크·역직렬화 절약).
 *
 * <p><b>등급 부스트(function_score)는 이번 범위 밖</b>(§6.1·A4, EPIC-GRADE 의존) — 순수 BM25 관련도다. 패싯(aggs)도 범위 밖.
 */
@Service
@RequiredArgsConstructor
public class ListingSearchService {

    private final ElasticsearchClient elasticsearchClient;
    private final ListingSearchProperties properties;

    /**
     * {@code q} 검색을 수행한다(계약 C1~C3). {@code q} 는 진입에서 길이 검증(2~64자, 위반 400 COMMON)한다.
     * {@code size + 1} 건을 조회해 hasNext 를 판정하고, 마지막 유효 히트로 다음 커서를 만든다. ES 질의 실패는
     * {@link SearchErrorCode#SEARCH_ENGINE_UNAVAILABLE}(503) — ES 는 파생 read-model 이라 목록 자체를 죽이지 않는다.
     *
     * @return 관련도 순 public_id 목록 + 다음 커서 + hasNext(빈 결과는 빈 목록, 계약 C3 "빈 결과=200")
     */
    @ServiceLog
    public ListingSearchResult search(ListingSearchCondition condition, String cursor, int size) {
        validateQuery(condition.q());
        SearchCursor decoded = SearchCursor.decode(cursor);
        String now = Instant.now().toString();

        try {
            SearchResponse<Void> response = elasticsearchClient.search(request -> {
                request.index(properties.indexAlias())
                    .query(query -> query.bool(bool -> bool
                        .must(textMatch(condition.q()))
                        .filter(filters(condition, now))))
                    .sort(sort -> sort.score(score -> score.order(SortOrder.Desc)))
                    .sort(sort -> sort.field(field -> field.field("publicId").order(SortOrder.Asc)))
                    .source(source -> source.fetch(false))
                    .size(size + 1);
                if (!decoded.isFirstPage()) {
                    request.searchAfter(FieldValue.of(decoded.score()), FieldValue.of(decoded.publicId()));
                }
                return request;
            }, Void.class);

            return toResult(response.hits().hits(), size);
        } catch (IOException | RuntimeException ex) {
            throw new BusinessException(SearchErrorCode.SEARCH_ENGINE_UNAVAILABLE);
        }
    }

    /** {@code q} 규약 검증(계약 C3). null/공백/길이 위반은 400({@code COMMON_001}) — 무의미 요청을 명시 거부한다. */
    private void validateQuery(String queryText) {
        if (queryText == null || queryText.isBlank()
            || queryText.length() < properties.minQueryLength()
            || queryText.length() > properties.maxQueryLength()) {
            throw new BusinessException(CommonErrorCode.INVALID_INPUT);
        }
    }

    /** nori 정밀(^3) + ngram 재현(^1) 멀티매치(§12.6). best_fields 기본 — 한 필드에 강하게 매칭될수록 우선. */
    private Query textMatch(String queryText) {
        return Query.of(query -> query.multiMatch(match -> match
            .query(queryText)
            .fields("nameSnapshot^3", "nameSnapshot.ngram^1")));
    }

    /** 코드축·범위·상태·리스팅종류 필터(filter context, 계약 C1 AND 결합). null 축은 건너뛴다. */
    private List<Query> filters(ListingSearchCondition condition, String now) {
        List<Query> filters = new ArrayList<>();
        filters.add(term("listingType", condition.listingType().name()));
        if (condition.statuses() != null && !condition.statuses().isEmpty()) {
            filters.add(terms("status", condition.statuses()));
        }
        addTerm(filters, "mainCategory", condition.mainCategory());
        addTerm(filters, "subGroup", condition.subGroup());
        addTerm(filters, "element", condition.element());
        addTerm(filters, "kind", condition.kind());
        addTerm(filters, "skill1", condition.skill1());
        addTerm(filters, "skill2", condition.skill2());
        addRange(filters, "level", condition.minLevel(), condition.maxLevel());
        addRange(filters, "price", condition.minPrice(), condition.maxPrice());
        addGoldforce(filters, condition.goldforceActive(), now);
        return filters;
    }

    private void addTerm(List<Query> filters, String field, Integer value) {
        if (value != null) {
            filters.add(term(field, String.valueOf(value)));
        }
    }

    private Query term(String field, String value) {
        return Query.of(query -> query.term(termQuery -> termQuery.field(field).value(FieldValue.of(value))));
    }

    private Query terms(String field, List<String> values) {
        List<FieldValue> fieldValues = values.stream().map(FieldValue::of).toList();
        return Query.of(query -> query.terms(termsQuery -> termsQuery
            .field(field).terms(builder -> builder.value(fieldValues))));
    }

    /** 숫자 범위 필터(level·price). min/max 각각 optional 이라 한쪽만 있어도 성립한다. */
    private void addRange(List<Query> filters, String field, Number min, Number max) {
        if (min == null && max == null) {
            return;
        }
        filters.add(Query.of(query -> query.range(range -> range.untyped(untyped -> {
            untyped.field(field);
            if (min != null) {
                untyped.gte(JsonData.of(min));
            }
            if (max != null) {
                untyped.lte(JsonData.of(max));
            }
            return untyped;
        }))));
    }

    /**
     * 골드포스 활성 필터(§12.4 스테일 해소) — 색인 boolean 이 아니라 {@code gfExpireAt} range 로 질의시점 판정한다.
     * TRUE=만료시각이 now 이후만, FALSE=필드 없음 또는 만료됨만, null=미필터.
     */
    private void addGoldforce(List<Query> filters, Boolean active, String now) {
        if (active == null) {
            return;
        }
        if (active) {
            filters.add(Query.of(query -> query.range(range -> range.untyped(untyped -> untyped
                .field("gfExpireAt").gt(JsonData.of(now))))));
            return;
        }
        Query expired = Query.of(query -> query.range(range -> range.untyped(untyped -> untyped
            .field("gfExpireAt").lte(JsonData.of(now)))));
        Query absent = Query.of(query -> query.bool(bool -> bool.mustNot(mustNot -> mustNot
            .exists(exists -> exists.field("gfExpireAt")))));
        filters.add(Query.of(query -> query.bool(bool -> bool.should(expired).should(absent).minimumShouldMatch("1"))));
    }

    /** size+1 조회 결과에서 hasNext 를 판정하고 public_id 목록·다음 커서를 만든다. */
    private ListingSearchResult toResult(List<Hit<Void>> hits, int size) {
        boolean hasNext = hits.size() > size;
        List<Hit<Void>> page = hasNext ? hits.subList(0, size) : hits;
        List<String> publicIds = page.stream().map(Hit::id).toList();

        String nextCursor = null;
        if (!page.isEmpty()) {
            Hit<Void> last = page.get(page.size() - 1);
            double score = last.score() == null ? 0.0 : last.score();
            nextCursor = SearchCursor.encode(score, last.id());
        }
        return new ListingSearchResult(publicIds, nextCursor, hasNext);
    }
}
