package com.finalcall.domain.search;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.SkillDefinition;
import com.finalcall.domain.shop.Shop;
import com.finalcall.domain.shop.ShopRepository;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
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
        return reindexAuctions() + reindexShops();
    }

    /** 경매 전건을 문서로 매핑해 bulk upsert 한다(itemInstance·template·skill fetch join). */
    @Transactional(readOnly = true)
    public int reindexAuctions() {
        List<ListingDocument> documents = auctionRepository.findAllForIndexing().stream()
            .map(this::toDocument)
            .toList();
        return bulkUpsert(documents);
    }

    /** 고정가 전건을 문서로 매핑해 bulk upsert 한다. */
    @Transactional(readOnly = true)
    public int reindexShops() {
        List<ListingDocument> documents = shopRepository.findAllForIndexing().stream()
            .map(this::toDocument)
            .toList();
        return bulkUpsert(documents);
    }

    /** 문서 목록을 alias 에 bulk upsert 한다(_id=publicId, 전체 문서 replace = 멱등). 빈 목록은 no-op. */
    public int bulkUpsert(List<ListingDocument> documents) {
        if (documents.isEmpty()) {
            return 0;
        }
        try {
            elasticsearchClient.bulk(bulk -> {
                for (ListingDocument document : documents) {
                    bulk.operations(operation -> operation.index(index -> index
                        .index(properties.indexAlias())
                        .id(document.publicId())
                        .document(document)));
                }
                return bulk;
            });
            return documents.size();
        } catch (Exception ex) {
            // 재색인/보정 실패는 배경 작업이라 목록·검색을 죽이지 않는다 — 로깅 후 다음 tick 이 재시도한다(화해 백스톱).
            log.error("리스팅 재색인 bulk upsert 실패 count={}", documents.size(), ex);
            return 0;
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
            .sellerNickname(auction.getSeller().getNickname())
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
            .sellerNickname(shop.getSeller().getNickname())
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
