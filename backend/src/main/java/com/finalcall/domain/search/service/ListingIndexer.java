package com.finalcall.domain.search.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.util.NicknameMasker;
import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.SkillDefinition;
import com.finalcall.domain.search.config.ListingSearchProperties;
import com.finalcall.domain.search.entity.ListingDocument;
import com.finalcall.domain.search.entity.ListingType;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.repository.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 리스팅 색인기(search, EPIC-SEARCH · search-spec §12.5). MySQL(정본) 조인을 읽어 <b>코드축까지 enrichment 된 전체
 * 문서를 ES 에 bulk upsert</b> 하는 <b>보정·백필 경로</b>다.
 *
 * <p>주 동기 경로는 Debezium CDC(앱 무침습, §12.3)이며 이 색인기는 그 CDC 파이프라인이 단일 테이블 캡처로는 못 채우는
 * 코드축·레벨·스킬·골드포스 enrichment 와 <b>화해 시 드리프트 보정</b>을 담당한다(§12.5 "직접 bulk upsert"). 이것은
 * dual-write 가 아니다 — 도메인 쓰기 경로(등록·입찰·구매)는 여전히 MySQL 만 쓰고, 이 upsert 는 비동기 재색인·보정이다.
 *
 * <p>문서 {@code _id} = 리스팅 {@code publicId}(멱등 upsert, 중복 무해). alias 로 upsert 하므로 재색인 alias 스위치 후에도
 * 신 인덱스로 이어쓴다(§12.5).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ListingIndexer {

    private final ElasticsearchClient elasticsearchClient;
    private final AuctionRepository auctionRepository;
    private final ShopRepository shopRepository;
    private final ListingSearchProperties properties;

    /** 경매+고정가 전건을 MySQL 에서 읽어 ES 로 재색인한다(화해 보정·수동 백필). 반환 = 색인한 문서 수. */
    @Transactional(readOnly = true)
    public int reindexAll() {
        return reindexAll(properties.indexAlias());
    }

    /** 지정한 물리 인덱스에 경매+고정가 전건을 직접 색인한다. REBUILD 백필 전용 strict 경로다. */
    @Transactional(readOnly = true)
    public int reindexAll(String targetIndex) {
        return reindexAuctions(targetIndex) + reindexShops(targetIndex);
    }

    /** 현재 MySQL SoT에서 색인할 listingType별 정확한 문서 수를 반환한다. */
    @Transactional(readOnly = true)
    public SearchIndexCounts sourceCounts() {
        return new SearchIndexCounts(auctionRepository.findAllForIndexing().size(),
            shopRepository.findAllForIndexing().size());
    }

    /** 경매 전건을 문서로 매핑해 bulk upsert 한다(itemInstance·template·skill fetch join). */
    @Transactional(readOnly = true)
    public int reindexAuctions() {
        return reindexAuctions(properties.indexAlias());
    }

    private int reindexAuctions(String targetIndex) {
        List<ListingDocument> documents = auctionRepository.findAllForIndexing().stream()
            .map(this::toDocument)
            .toList();
        return bulkUpsert(documents, targetIndex);
    }

    /** 고정가 전건을 문서로 매핑해 bulk upsert 한다. */
    @Transactional(readOnly = true)
    public int reindexShops() {
        return reindexShops(properties.indexAlias());
    }

    private int reindexShops(String targetIndex) {
        List<ListingDocument> documents = shopRepository.findAllForIndexing().stream()
            .map(this::toDocument)
            .toList();
        return bulkUpsert(documents, targetIndex);
    }

    /** 문서 목록을 alias 에 bulk upsert 한다(_id=publicId, 전체 문서 replace = 멱등). 빈 목록은 no-op. */
    public int bulkUpsert(List<ListingDocument> documents) {
        return bulkUpsert(documents, properties.indexAlias());
    }

    private int bulkUpsert(List<ListingDocument> documents, String targetIndex) {
        if (documents.isEmpty()) {
            return 0;
        }
        try {
            BulkResponse response = elasticsearchClient.bulk(bulk -> {
                for (ListingDocument document : documents) {
                    bulk.operations(operation -> operation.index(index -> index
                        .index(targetIndex)
                        .id(document.publicId())
                        .document(document)));
                }
                return bulk;
            });
            if (response.errors()) {
                String reason = response.items().stream()
                    .filter(item -> item.error() != null)
                    .map(BulkResponseItem::error)
                    .map(error -> error.reason())
                    .findFirst()
                    .orElse("알 수 없는 bulk 부분 실패");
                throw new IllegalStateException("리스팅 bulk upsert 부분 실패: " + reason);
            }
            return documents.size();
        } catch (Exception ex) {
            throw new IllegalStateException("리스팅 bulk upsert 실패 target=" + targetIndex, ex);
        }
    }

    private ListingDocument toDocument(Auction auction) {
        ItemInstance item = auction.getItemInstance();
        ItemTemplate template = item.getTemplate();
        return ListingDocument.builder()
            .listingType(ListingType.AUCTION.name())
            .publicId(auction.getPublicId())
            .nameSnapshot(auction.getItemNameSnapshot())
            .specSnapshot(auction.getItemSpecSnapshot())
            .mainCategory(String.valueOf(template.getMainCategory()))
            .subGroup(String.valueOf(template.getSubGroup()))
            .element(String.valueOf(template.getElement()))
            .kind(String.valueOf(template.getKind()))
            .skill1(skillCode(item.getSkill1()))
            .skill2(skillCode(item.getSkill2()))
            .level(item.getLevel())
            .price(auction.getStartPrice())
            .highestBidAmount(auction.getHighestBidAmount())
            .gfExpireAt(toIso(item.getGfExpireAt()))
            .status(auction.getStatus().name())
            .sellerNickname(NicknameMasker.mask(auction.getSeller().getNickname()))
            .endsAt(toIso(auction.getEndAt()))
            .createdAt(toIso(auction.getCreatedAt()))
            .build();
    }

    private ListingDocument toDocument(Shop shop) {
        ItemInstance item = shop.getItemInstance();
        ItemTemplate template = item.getTemplate();
        return ListingDocument.builder()
            .listingType(ListingType.SHOP.name())
            .publicId(shop.getPublicId())
            .nameSnapshot(shop.getItemNameSnapshot())
            .specSnapshot(shop.getItemSpecSnapshot())
            .mainCategory(String.valueOf(template.getMainCategory()))
            .subGroup(String.valueOf(template.getSubGroup()))
            .element(String.valueOf(template.getElement()))
            .kind(String.valueOf(template.getKind()))
            .skill1(skillCode(item.getSkill1()))
            .skill2(skillCode(item.getSkill2()))
            .level(item.getLevel())
            .price(shop.getPrice())
            .highestBidAmount(null)
            .gfExpireAt(toIso(item.getGfExpireAt()))
            .status(shop.getStatus().name())
            .sellerNickname(NicknameMasker.mask(shop.getSeller().getNickname()))
            .endsAt(toIso(shop.getEndAt()))
            .createdAt(toIso(shop.getCreatedAt()))
            .build();
    }

    private String skillCode(SkillDefinition skill) {
        return skill == null ? null : String.valueOf(skill.getSkillCode());
    }

    private String toIso(Instant instant) {
        return instant == null ? null : instant.toString();
    }
}
