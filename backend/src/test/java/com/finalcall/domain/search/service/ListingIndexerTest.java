package com.finalcall.domain.search.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.search.config.ListingSearchProperties;
import com.finalcall.domain.search.entity.ListingDocument;
import com.finalcall.domain.shop.repository.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import co.elastic.clients.elasticsearch.core.bulk.OperationType;

class ListingIndexerTest {

    @Test
    void bulk_부분_실패를_성공_count로_삼키지_않는다() throws Exception {
        ElasticsearchClient client = mock(ElasticsearchClient.class);
        BulkResponse partialFailure = BulkResponse.of(response -> response
            .errors(true)
            .took(1)
            .items(item -> item
                .operationType(OperationType.Index)
                .index("listings_search")
                .id("A1")
                .status(400)
                .error(error -> error.type("mapper_parsing_exception").reason("invalid field"))));
        when(client.bulk(any(java.util.function.Function.class))).thenReturn(partialFailure);
        ListingIndexer indexer = new ListingIndexer(client, mock(AuctionRepository.class), mock(ShopRepository.class),
            new ListingSearchProperties("listings_search", 2, 64, false));
        ListingDocument document = ListingDocument.builder().publicId("A1").listingType("AUCTION").build();

        assertThatThrownBy(() -> indexer.bulkUpsert(List.of(document)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("bulk upsert 실패");
    }
}
