package com.finalcall.integration;

import static org.hamcrest.Matchers.hasItems;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/** 홈 오늘의 추천 마켓 계약을 실제 MySQL(Testcontainers)과 공개 Security 체인으로 검증한다. */
@Transactional
class HomeShopRecommendationApiIntegrationTest extends IntegrationTest {

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Test
    void 비로그인_요청은_추천_이유별_6건과_단일_계산시각을_반환한다() throws Exception {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        User buyer = user("home_buyer", "구매자");
        User generalSeller = user("home_general", "일반");
        User trustedSeller = user("home_trusted", "검증");
        User endingSeller1 = user("home_end_1", "마감1");
        User endingSeller2 = user("home_end_2", "마감2");
        User newSeller1 = user("home_new_1", "신규1");
        User newSeller2 = user("home_new_2", "신규2");
        User newSeller3 = user("home_new_3", "신규3");

        shop(generalSeller, 9710, now.plus(7, ChronoUnit.DAYS));
        shop(trustedSeller, 9711, now.plus(7, ChronoUnit.DAYS));
        for (int index = 0; index < 5; index++) {
            saleOrder(trustedSeller, buyer, 9720 + index, 10_000L + index);
        }
        shop(endingSeller1, 9731, now.plus(1, ChronoUnit.HOURS));
        shop(endingSeller2, 9732, now.plus(2, ChronoUnit.HOURS));
        shop(newSeller1, 9741, now.plus(7, ChronoUnit.DAYS));
        shop(newSeller2, 9742, now.plus(7, ChronoUnit.DAYS));
        shop(newSeller3, 9743, now.plus(7, ChronoUnit.DAYS));
        em.flush();
        em.clear();

        mockMvc.perform(get("/api/v1/home/shop-recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.calculatedAt").isNotEmpty())
            .andExpect(jsonPath("$.data.items.length()").value(6))
            .andExpect(jsonPath("$.data.items[0].reason").value("NEW"))
            .andExpect(jsonPath("$.data.items[1].reason").value("NEW"))
            .andExpect(jsonPath("$.data.items[2].reason").value("NEW"))
            .andExpect(jsonPath("$.data.items[3].reason").value("ENDING_SOON"))
            .andExpect(jsonPath("$.data.items[4].reason").value("ENDING_SOON"))
            .andExpect(jsonPath("$.data.items[5].reason").value("TRUSTED_SELLER"))
            .andExpect(jsonPath("$.data.items[5].shop.sellerCompletedSales").value(5));
    }

    @Test
    void 종료된_판매는_제외하고_후보가_없으면_빈_배열을_반환한다() throws Exception {
        User seller = user("home_closed", "종료");
        shop(seller, 9751, Instant.now().minus(1, ChronoUnit.MINUTES));
        em.flush();
        em.clear();

        mockMvc.perform(get("/api/v1/home/shop-recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items").isArray())
            .andExpect(jsonPath("$.data.items").isEmpty());
    }

    @Test
    void 다양성_제한으로_부족하면_템플릿과_판매자_순서로_완화해_GENERAL로_채운다() throws Exception {
        User seller = user("home_relaxed", "완화");
        Instant endAt = Instant.now().plus(7, ChronoUnit.DAYS);
        for (int index = 0; index < 6; index++) {
            shop(seller, 9761, endAt);
        }
        em.flush();
        em.clear();

        mockMvc.perform(get("/api/v1/home/shop-recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(6))
            .andExpect(jsonPath("$.data.items[0].reason").value("NEW"))
            .andExpect(jsonPath("$.data.items[1].reason").value("GENERAL"))
            .andExpect(jsonPath("$.data.items[5].reason").value("GENERAL"));
    }

    @Test
    void 상위_30건이_같은_판매자여도_다음_페이지의_다양한_후보를_먼저_선택한다() throws Exception {
        Instant endAt = Instant.now().plus(7, ChronoUnit.DAYS);
        for (int index = 0; index < 5; index++) {
            shop(user("home_boundary_" + index, "경계" + index), 9770 + index, endAt);
        }
        User dominantSeller = user("home_dominant", "상위판매자");
        for (int index = 0; index < 30; index++) {
            shop(dominantSeller, 9781, endAt);
        }
        em.flush();
        em.clear();

        mockMvc.perform(get("/api/v1/home/shop-recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.items.length()").value(6))
            .andExpect(jsonPath("$.data.items[*].shop.sellerNickname",
                hasItems("상위판매자", "경계0", "경계1", "경계2", "경계3", "경계4")));
    }

    private User user(String loginId, String nickname) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        return user;
    }

    private Shop shop(User seller, int typeCode, Instant endAt) {
        ItemInstance item = listedItem(seller, typeCode);
        Shop shop = Shop.builder()
            .seller(seller).itemInstance(item).price(1_000_000L).status(ShopStatus.ACTIVE).endAt(endAt)
            .itemNameSnapshot("홈 추천 아이템").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(shop);
        return shop;
    }

    private void saleOrder(User seller, User buyer, int typeCode, long sourceId) {
        SaleOrder order = SaleOrder.builder()
            .sourceType(SaleOrderSourceType.SHOP).sourceId(sourceId)
            .buyer(buyer).seller(seller).itemInstance(listedItem(seller, typeCode))
            .finalPrice(1_000_000L).feeAmount(50_000L).settleAmount(950_000L)
            .feePolicyVersion("v1").settledAt(Instant.now())
            .build();
        em.persist(order);
    }

    private ItemInstance listedItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("홈 추천 템플릿 " + typeCode).build()));
    }
}
