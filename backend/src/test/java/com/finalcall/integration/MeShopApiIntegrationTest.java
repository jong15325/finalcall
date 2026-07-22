package com.finalcall.integration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserBalance;
import com.finalcall.domain.shop.Shop;
import com.finalcall.domain.shop.ShopStatus;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 내 판매 목록(GET /me/shops) API 통합 검증(shop, FC-104 / EPIC-SHOP-MANAGE) — 실제 MySQL(Testcontainers) +
 * Security 필터. 계약 §3.2. 판매자=주체 스코프(IDOR)·status 필터(ACTIVE 기본·ALL)·페이징·예상 정산 계산·공개
 * {@code GET /shops} 무오염(fee/settle 미유입)을 고정한다. <b>945x 대역</b>.
 *
 * <p>배선·인증·응답 형태만 본다(@Transactional 롤백). price 1,000,000 → 예상 수수료 51,000·예상 정산 949,000
 * (fee-policy v1.0 tiers: 100k×6% + 900k×5% = 51,000).
 */
@Transactional
class MeShopApiIntegrationTest extends IntegrationTest {

    private static final long PRICE = 1_000_000L;
    private static final long EXPECTED_FEE = 51_000L;
    private static final long EXPECTED_SETTLE = 949_000L;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Test
    void 내판매는_본인것만_status기본ACTIVE로_반환한다() throws Exception {
        User seller = persistUser("ms_own_s", "판매", 0L);
        User other = persistUser("ms_own_o", "타인", 0L);
        persistShop(seller, 9450, PRICE, ShopStatus.ACTIVE);
        persistShop(seller, 9451, PRICE, ShopStatus.SOLD); // 종료분 — 기본(ACTIVE)에서 제외
        persistShop(other, 9452, PRICE, ShopStatus.ACTIVE); // 타인 리스팅 — 미노출
        flushClear();

        // 기본(status 생략) = ACTIVE 만, 본인 것만 → 정확히 1건.
        mockMvc.perform(get("/api/v1/me/shops").with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.content[0].sellerNickname").value("판매"));
    }

    @Test
    void 내판매_status_ALL은_본인_전상태를_반환한다() throws Exception {
        User seller = persistUser("ms_all_s", "판매", 0L);
        User other = persistUser("ms_all_o", "타인", 0L);
        persistShop(seller, 9453, PRICE, ShopStatus.ACTIVE);
        persistShop(seller, 9454, PRICE, ShopStatus.SOLD);
        persistShop(seller, 9455, PRICE, ShopStatus.CANCELLED);
        persistShop(other, 9456, PRICE, ShopStatus.ACTIVE); // 타인 — ALL 이어도 미노출
        flushClear();

        mockMvc.perform(get("/api/v1/me/shops").param("status", "ALL")
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(3));
    }

    @Test
    void 내판매_status_SOLD는_해당_상태만_반환한다() throws Exception {
        User seller = persistUser("ms_sold_s", "판매", 0L);
        persistShop(seller, 9457, PRICE, ShopStatus.ACTIVE);
        persistShop(seller, 9458, PRICE, ShopStatus.SOLD);
        flushClear();

        mockMvc.perform(get("/api/v1/me/shops").param("status", "SOLD")
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].status").value("SOLD"));
    }

    @Test
    void 내판매는_예상_수수료와_정산액을_계산해_노출한다() throws Exception {
        User seller = persistUser("ms_fee_s", "판매", 0L);
        persistShop(seller, 9459, PRICE, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/me/shops").with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].price").value(PRICE))
            .andExpect(jsonPath("$.data.content[0].estimatedFee").value(EXPECTED_FEE))
            .andExpect(jsonPath("$.data.content[0].estimatedSettle").value(EXPECTED_SETTLE))
            .andExpect(jsonPath("$.data.content[0].item.nameSnapshot").isNotEmpty());
    }

    @Test
    void 내판매는_cursor로_페이지네이션한다() throws Exception {
        User seller = persistUser("ms_page_s", "판매", 0L);
        persistShop(seller, 9460, PRICE, ShopStatus.ACTIVE);
        persistShop(seller, 9461, 2_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/me/shops").param("size", "1")
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());
    }

    @Test
    void 공개목록_GET_shops에는_예상정산이_유입되지_않는다() throws Exception {
        User seller = persistUser("ms_pub_s", "판매", 0L);
        persistShop(seller, 9462, PRICE, ShopStatus.ACTIVE);
        flushClear();

        // 공개 브라우즈 ShopSummary 는 판매자 회계값을 담지 않는다(별도 DTO 격리).
        mockMvc.perform(get("/api/v1/shops").param("mainCategory", "9").param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].price").value(PRICE))
            .andExpect(jsonPath("$.data.content[0].estimatedFee").doesNotExist())
            .andExpect(jsonPath("$.data.content[0].estimatedSettle").doesNotExist());
    }

    @Test
    void 인증없는_내판매는_401이다() throws Exception {
        mockMvc.perform(get("/api/v1/me/shops"))
            .andExpect(status().isUnauthorized());
    }

    // ---------------- helpers ----------------

    private void flushClear() {
        em.flush();
        em.clear();
    }

    private Shop persistShop(User seller, int typeCode, long price, ShopStatus statusValue) {
        ItemInstance item = persistListedItem(seller, typeCode);
        Instant endAt = Instant.now().plus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MILLIS);
        Shop shop = Shop.builder()
            .seller(seller).itemInstance(item).price(price).status(statusValue).endAt(endAt)
            .itemNameSnapshot("내판매API템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(shop);
        return shop;
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
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
                .typeCode(typeCode).displayName("내판매API템플릿").build()));
    }

    private User persistUser(String loginId, String nickname, long gameMoney) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        em.persist(balance);
        return user;
    }
}
