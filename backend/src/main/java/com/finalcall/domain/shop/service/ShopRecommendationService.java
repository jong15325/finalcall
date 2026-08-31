package com.finalcall.domain.shop.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.common.logging.ServiceLog;
import com.finalcall.domain.item.service.CardInfoFactory;
import com.finalcall.domain.settlement.repository.SaleOrderRepository;
import com.finalcall.domain.shop.dto.ShopRecommendationItemResponse;
import com.finalcall.domain.shop.dto.ShopRecommendationsResponse;
import com.finalcall.domain.shop.dto.ShopSummaryResponse;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopRecommendationReason;
import com.finalcall.domain.shop.repository.ShopRepository;

import lombok.RequiredArgsConstructor;

/** 홈 오늘의 추천 마켓 후보를 단일 기준 시각과 계약된 다양성 규칙으로 조립한다. */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ShopRecommendationService {

    private static final int MAX_ITEMS = 6;
    static final int MAX_RECOMMENDATION_QUERY_COUNT = 25;
    private static final long TRUSTED_SELLER_MINIMUM_SALES = 5L;
    private static final Duration ENDING_SOON_WINDOW = Duration.ofHours(24);

    private final ShopRepository shopRepository;
    private final SaleOrderRepository saleOrderRepository;
    private final CardInfoFactory cardInfoFactory;
    private final Clock clock;

    @ServiceLog
    public ShopRecommendationsResponse getRecommendations() {
        Instant calculatedAt = clock.instant();
        List<SelectedShop> selected = new ArrayList<>(MAX_ITEMS);
        SelectionState state = new SelectionState();
        CandidateQuery newest = (shopIds, sellerIds, templateIds) -> shopRepository
            .findNewestRecommendationCandidate(calculatedAt, shopIds, sellerIds, templateIds);
        CandidateQuery endingSoon = (shopIds, sellerIds, templateIds) -> shopRepository
            .findEndingSoonRecommendationCandidate(
                calculatedAt, calculatedAt.plus(ENDING_SOON_WINDOW), shopIds, sellerIds, templateIds);
        CandidateQuery trusted = (shopIds, sellerIds, templateIds) -> shopRepository
            .findTrustedSellerRecommendationCandidate(
                calculatedAt, TRUSTED_SELLER_MINIMUM_SALES, shopIds, sellerIds, templateIds);

        fill(newest, ShopRecommendationReason.NEW, 3, selected, state, true, true);
        fill(endingSoon, ShopRecommendationReason.ENDING_SOON, 2, selected, state, true, true);
        fill(trusted, ShopRecommendationReason.TRUSTED_SELLER, 1, selected, state, true, true);

        fill(newest, ShopRecommendationReason.GENERAL, MAX_ITEMS - selected.size(), selected, state, true, true);
        fill(newest, ShopRecommendationReason.GENERAL, MAX_ITEMS - selected.size(), selected, state, true, false);
        fill(newest, ShopRecommendationReason.GENERAL, MAX_ITEMS - selected.size(), selected, state, false, false);

        Set<Long> sellerIds = new HashSet<>();
        for (SelectedShop item : selected) {
            sellerIds.add(item.shop().getSeller().getId());
        }
        Map<Long, Long> completedSales = saleOrderRepository.countCompletedSalesBySellerIds(sellerIds);
        List<ShopRecommendationItemResponse> items = selected.stream()
            .map(item -> ShopRecommendationItemResponse.builder()
                .reason(item.reason())
                .shop(ShopSummaryResponse.from(
                    item.shop(), completedSales.getOrDefault(item.shop().getSeller().getId(), 0L),
                    cardInfoFactory.create(item.shop().getItemInstance(), calculatedAt)))
                .build())
            .toList();
        return ShopRecommendationsResponse.builder().items(items).calculatedAt(calculatedAt).build();
    }

    /** 후보 판정 18회 + 성공 hydrate 6회 + 판매 집계 1회 이하여서 {@link #MAX_RECOMMENDATION_QUERY_COUNT}를 넘지 않는다. */
    private void fill(CandidateQuery query, ShopRecommendationReason reason, int target,
        List<SelectedShop> selected, SelectionState state, boolean sellerLimit, boolean templateLimit) {
        int added = 0;
        while (added < target && selected.size() < MAX_ITEMS) {
            Set<Long> excludedSellers = sellerLimit ? state.sellerCounts.keySet() : Set.of();
            Set<Long> excludedTemplates = templateLimit ? state.limitReachedTemplateIds() : Set.of();
            Optional<Shop> candidate = query.find(state.selectedIds, excludedSellers, excludedTemplates);
            if (candidate.isEmpty()) {
                return;
            }
            Shop shop = candidate.orElseThrow();
            Long sellerId = shop.getSeller().getId();
            Long templateId = shop.getItemInstance().getTemplate().getId();
            selected.add(new SelectedShop(reason, shop));
            state.selectedIds.add(shop.getId());
            state.sellerCounts.merge(sellerId, 1, Integer::sum);
            state.templateCounts.merge(templateId, 1, Integer::sum);
            added++;
        }
    }

    private record SelectedShop(ShopRecommendationReason reason, Shop shop) {
    }

    @FunctionalInterface
    private interface CandidateQuery {
        Optional<Shop> find(Set<Long> excludedShopIds, Set<Long> excludedSellerIds, Set<Long> excludedTemplateIds);
    }

    private static final class SelectionState {
        private final Set<Long> selectedIds = new HashSet<>();
        private final Map<Long, Integer> sellerCounts = new HashMap<>();
        private final Map<Long, Integer> templateCounts = new HashMap<>();

        private Set<Long> limitReachedTemplateIds() {
            Set<Long> ids = new HashSet<>();
            templateCounts.forEach((id, count) -> {
                if (count >= 2) {
                    ids.add(id);
                }
            });
            return ids;
        }
    }
}
