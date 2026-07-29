package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.settlement.entity.SaleOrder;
import com.finalcall.domain.settlement.entity.SaleOrderSourceType;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.entity.ShopStatus;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 고정가 등록·목록·상세·구매·취소 API 통합 검증(shop, FC-093) — 실제 MySQL(Testcontainers) + Security 필터. 계약
 * §3.2·§3.3·§5. 컨트롤러 배선·인증·응답 형태(ApiResponse)·에러 HTTP 매핑·기한 자동 계산을 고정한다.
 *
 * <p>서비스 계층 불변식·동시성은 {@code ShopPurchaseSettlementIntegrationTest}·
 * {@code ShopPurchaseConcurrencyIntegrationTest}·{@code ShopExpiryAndCancelIntegrationTest} 가 실제 커밋으로 검증한다.
 * 여기서는 배선·인증·에러코드 HTTP status 만 본다(@Transactional 롤백). <b>943x 대역</b>.
 */
@Transactional
class ShopApiIntegrationTest extends IntegrationTest {

    private static final long BALANCE = 100_000_000L;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    // ---------------- 등록 ----------------

    @Test
    void 등록은_201과_ACTIVE_endAt을_반환하고_item을_LISTED로_전이한다() throws Exception {
        User seller = persistUser("sa_reg1", "판매", 0L);
        ItemInstance item = persistInventoryItem(seller, 0, 9431);
        flushClear();

        mockMvc.perform(post("/api/v1/shops").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1_000_000L)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.shopPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.endAt").isNotEmpty()); // 서버 자동 계산 기한 노출

        flushClear();
        ItemInstance reloaded = itemInstanceRepository.findById(item.getId()).orElseThrow();
        assertThat(reloaded.getLocation()).isEqualTo(ItemLocation.LISTED);
        assertThat(reloaded.getSlotNo()).isNull();
    }

    @Test
    void 등록_가격이_0이하면_400_검증오류() throws Exception {
        User seller = persistUser("sa_reg2", "판매", 0L);
        ItemInstance item = persistInventoryItem(seller, 0, 9432);
        flushClear();

        mockMvc.perform(post("/api/v1/shops").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 0L)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void 등록_타인_아이템은_403_SHOP_001() throws Exception {
        User seller = persistUser("sa_reg3", "판매", 0L);
        User attacker = persistUser("sa_atk3", "타인", 0L);
        ItemInstance item = persistInventoryItem(seller, 0, 9433);
        flushClear();

        mockMvc.perform(post("/api/v1/shops").with(user(String.valueOf(attacker.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1_000_000L)))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("SHOP_001"));
    }

    @Test
    void 등록_이미_출품중인_아이템은_409_SHOP_002() throws Exception {
        User seller = persistUser("sa_reg4", "판매", 0L);
        ItemInstance listed = persistListedItem(seller, 9434); // 이미 LISTED.
        flushClear();

        mockMvc.perform(post("/api/v1/shops").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(listed.getPublicId(), 1_000_000L)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SHOP_002"));
    }

    // ---------------- 목록·상세 ----------------

    @Test
    void 목록은_판매중_고정가만_cursor로_반환한다() throws Exception {
        User seller = persistUser("sa_list1", "판매", 0L);
        persistShop(seller, 9435, 1_000_000L, ShopStatus.ACTIVE);
        persistShop(seller, 9436, 2_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/shops").param("size", "1").param("mainCategory", "9"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());
    }

    @Test
    void 상세는_200과_스냅샷을_반환하고_없으면_404_SHOP_003() throws Exception {
        User seller = persistUser("sa_det1", "판매", 0L);
        Shop shop = persistShop(seller, 9437, 1_500_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/shops/{id}", shop.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.shopPublicId").value(shop.getPublicId()))
            .andExpect(jsonPath("$.data.price").value(1_500_000L))
            .andExpect(jsonPath("$.data.item.nameSnapshot").isNotEmpty());

        mockMvc.perform(get("/api/v1/shops/{id}", "00000000000000000000000000"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("SHOP_003"));
    }

    // ---------------- 판매자 완료 판매 건수(sellerCompletedSales, FC-149) ----------------

    @Test
    void 목록과_상세는_판매자_완료판매_건수를_두채널_합산해_노출한다() throws Exception {
        User seller = persistUser("sa_scs_s", "판매", 0L);
        User buyer = persistUser("sa_scs_b", "구매", 0L);
        // 경매 낙찰 1건 + 마켓 판매 1건 = 완료 2건(source_type 무관 합산). 취소·유찰·만료는 애초에 행 없음.
        persistSaleOrder(seller, buyer, SaleOrderSourceType.AUCTION, 5001L, 9461);
        persistSaleOrder(seller, buyer, SaleOrderSourceType.SHOP, 5002L, 9462);
        Shop shop = persistShop(seller, 9463, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/shops").param("mainCategory", "9"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].sellerCompletedSales").value(2));

        mockMvc.perform(get("/api/v1/shops/{id}", shop.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.sellerCompletedSales").value(2));
    }

    @Test
    void 내판매_응답도_판매자_완료판매_건수를_노출한다() throws Exception {
        User seller = persistUser("sa_scms_s", "판매", 0L);
        User buyer = persistUser("sa_scms_b", "구매", 0L);
        persistSaleOrder(seller, buyer, SaleOrderSourceType.SHOP, 5003L, 9464);
        persistShop(seller, 9465, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/me/shops").param("status", "ALL")
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].sellerCompletedSales").value(1));
    }

    @Test
    void 판매이력_없는_판매자는_완료판매_0을_노출한다() throws Exception {
        User seller = persistUser("sa_sc0_s", "판매", 0L);
        // 취소된 리스팅이 있어도 sale_order 가 없어 완료 건수는 0(취소·만료 자동 제외).
        persistShop(seller, 9466, 1_000_000L, ShopStatus.CANCELLED);
        Shop active = persistShop(seller, 9467, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(get("/api/v1/shops/{id}", active.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.sellerCompletedSales").value(0));
    }

    // ---------------- 구매 ----------------

    @Test
    void 구매_성공은_201과_orderPublicId_finalPrice를_반환한다() throws Exception {
        User seller = persistUser("sa_buy_s", "판매", 0L);
        User buyer = persistUser("sa_buy_b", "구매", BALANCE);
        Shop shop = persistShop(seller, 9438, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/purchase", shop.getPublicId())
            .with(user(String.valueOf(buyer.getId()))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.orderPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.finalPrice").value(1_000_000L));
    }

    @Test
    void 구매_자기구매는_403_SHOP_006() throws Exception {
        User seller = persistUser("sa_self_s", "판매", BALANCE);
        Shop shop = persistShop(seller, 9439, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/purchase", shop.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("SHOP_006"));
    }

    @Test
    void 구매_잔액부족은_422_SHOP_005() throws Exception {
        User seller = persistUser("sa_poor_s", "판매", 0L);
        User buyer = persistUser("sa_poor_b", "구매", 100_000L);
        Shop shop = persistShop(seller, 9440, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/purchase", shop.getPublicId())
            .with(user(String.valueOf(buyer.getId()))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("SHOP_005"));
    }

    @Test
    void 인증없는_구매는_401이다() throws Exception {
        User seller = persistUser("sa_anon_s", "판매", 0L);
        Shop shop = persistShop(seller, 9441, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/purchase", shop.getPublicId()))
            .andExpect(status().isUnauthorized());
    }

    // ---------------- 취소 ----------------

    @Test
    void 취소는_200_CANCELLED를_반환한다() throws Exception {
        User seller = persistUser("sa_can1", "판매", 0L);
        Shop shop = persistShop(seller, 9442, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/cancel", shop.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    @Test
    void 취소_타인은_403_SHOP_001() throws Exception {
        User seller = persistUser("sa_can2", "판매", 0L);
        User attacker = persistUser("sa_atk2", "타인", 0L);
        Shop shop = persistShop(seller, 9443, 1_000_000L, ShopStatus.ACTIVE);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/cancel", shop.getPublicId())
            .with(user(String.valueOf(attacker.getId()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("SHOP_001"));
    }

    @Test
    void 취소_이미_종료된_고정가는_409_SHOP_004() throws Exception {
        User seller = persistUser("sa_can3", "판매", 0L);
        Shop shop = persistShop(seller, 9444, 1_000_000L, ShopStatus.CANCELLED);
        flushClear();

        mockMvc.perform(post("/api/v1/shops/{id}/cancel", shop.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("SHOP_004"));
    }

    // ---------------- helpers ----------------

    private void flushClear() {
        em.flush();
        em.clear();
    }

    private String registerBody(String itemInstancePublicId, long price) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("itemInstancePublicId", itemInstancePublicId);
        body.put("price", price);
        return objectMapper.writeValueAsString(body);
    }

    private Shop persistShop(User seller, int typeCode, long price, ShopStatus status) {
        ItemInstance item = persistListedItem(seller, typeCode);
        Instant endAt = Instant.now().plus(7, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MILLIS);
        Shop shop = Shop.builder()
            .seller(seller).itemInstance(item).price(price).status(status).endAt(endAt)
            .itemNameSnapshot("고정가API템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(shop);
        return shop;
    }

    /** 완료(정산 성립) 판매 1건을 나타내는 sale_order 를 직접 심는다(집계 대상 — 완료 건수는 행 존재 자체가 정의). */
    private void persistSaleOrder(User seller, User buyer, SaleOrderSourceType sourceType, long sourceId,
        int typeCode) {
        // LISTED(slot NULL) 아이템 — INVENTORY slot_key UK 충돌 회피(집계는 아이템 위치 무관).
        ItemInstance item = persistListedItem(seller, typeCode);
        SaleOrder order = SaleOrder.builder()
            .sourceType(sourceType).sourceId(sourceId)
            .buyer(buyer).seller(seller).itemInstance(item)
            .finalPrice(1_000_000L).feeAmount(50_000L).settleAmount(950_000L)
            .feePolicyVersion("v1").settledAt(Instant.now())
            .build();
        em.persist(order);
    }

    private ItemInstance persistInventoryItem(User owner, int slotNo, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.INVENTORY).slotNo(slotNo).build();
        em.persist(item);
        return item;
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
                .typeCode(typeCode).displayName("고정가API템플릿").build()));
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
