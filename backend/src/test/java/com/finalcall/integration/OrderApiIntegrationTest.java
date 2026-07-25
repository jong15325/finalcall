package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.settlement.SaleOrder;
import com.finalcall.domain.settlement.SaleOrderSourceType;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 거래내역(주문) 조회 API 통합 검증(order, FC-089) — 실제 MySQL(Testcontainers) + Security 필터. purchase-spec §5
 * IDOR 스코프(B1)·역할별 노출(B2)을 응답 본문으로 고정한다.
 *
 * <p><b>노출 단언을 응답 본문 원문으로도 확인한다</b> — 구매자 응답에 fee/settle 가 필드로도 새지 않아야 한다(B2
 * 경제 정보 비대칭 차단). 상대 식별자는 마스킹만 나가야 한다(§3.3). 다른 테스트 템플릿과 충돌하지 않도록
 * <b>95xx 대역</b>을 쓴다.
 */
@Transactional
class OrderApiIntegrationTest extends IntegrationTest {

    private static final long FINAL_PRICE = 2_480_000L;
    private static final long FEE = 110_200L;
    private static final long SETTLE = 2_369_800L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Test
    void 구매자_목록은_상대_마스킹만_보이고_수수료_정산액은_필드로도_부재한다() throws Exception {
        User seller = persistUser("ord_b_seller", "김판매", 0L);
        User buyer = persistUser("ord_b_buyer", "이구매", 0L);
        persistOrder(buyer, seller, persistListedItem(seller, 9501), 1001L);
        flushClear();

        String body = mockMvc.perform(get("/api/v1/me/orders").with(user(String.valueOf(buyer.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].myRole").value("BUYER"))
            .andExpect(jsonPath("$.data.content[0].sourceType").value("AUCTION"))
            .andExpect(jsonPath("$.data.content[0].finalPrice").value(FINAL_PRICE))
            .andExpect(jsonPath("$.data.content[0].counterpartyMasked").value("김판***"))
            // 구매자에겐 수수료·정산액 필드가 아예 없다(NON_NULL 제외).
            .andExpect(jsonPath("$.data.content[0].feeAmount").doesNotExist())
            .andExpect(jsonPath("$.data.content[0].settleAmount").doesNotExist())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        // 원문 누설 방지: 상대 실닉네임·loginId·fee/settle 키가 어떤 형태로도 새지 않는다.
        assertThat(body).doesNotContain("김판매").doesNotContain("ord_b_seller")
            .doesNotContain("feeAmount").doesNotContain("settleAmount")
            .doesNotContain(String.valueOf(FEE)).doesNotContain(String.valueOf(SETTLE));
    }

    @Test
    void 판매자_목록은_수수료_정산액을_노출한다() throws Exception {
        User seller = persistUser("ord_s_seller", "박판매", 0L);
        User buyer = persistUser("ord_s_buyer", "최구매", 0L);
        persistOrder(buyer, seller, persistListedItem(seller, 9502), 1002L);
        flushClear();

        mockMvc.perform(get("/api/v1/me/orders").with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].myRole").value("SELLER"))
            .andExpect(jsonPath("$.data.content[0].counterpartyMasked").value("최구***"))
            .andExpect(jsonPath("$.data.content[0].feeAmount").value(FEE))
            .andExpect(jsonPath("$.data.content[0].settleAmount").value(SETTLE));
    }

    @Test
    void 목록은_제3자_주문을_노출하지_않는다() throws Exception {
        User seller = persistUser("ord_3_seller", "판매", 0L);
        User buyer = persistUser("ord_3_buyer", "구매", 0L);
        User stranger = persistUser("ord_3_stranger", "제3자", 0L);
        persistOrder(buyer, seller, persistListedItem(seller, 9503), 1003L);
        flushClear();

        mockMvc.perform(get("/api/v1/me/orders").with(user(String.valueOf(stranger.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(0));
    }

    @Test
    void 상세는_제3자에게_403_ORDER_002() throws Exception {
        User seller = persistUser("ord_d_seller", "판매D", 0L);
        User buyer = persistUser("ord_d_buyer", "구매D", 0L);
        User stranger = persistUser("ord_d_stranger", "제3자D", 0L);
        SaleOrder order = persistOrder(buyer, seller, persistListedItem(seller, 9504), 1004L);
        flushClear();

        mockMvc.perform(get("/api/v1/orders/{id}", order.getPublicId()).with(user(String.valueOf(stranger.getId()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("ORDER_002"));
    }

    @Test
    void 상세는_구매자엔_fee_settle_없이_판매자엔_있게_역할별로_노출한다() throws Exception {
        User seller = persistUser("ord_r_seller", "판매R", 0L);
        User buyer = persistUser("ord_r_buyer", "구매R", 0L);
        SaleOrder order = persistOrder(buyer, seller, persistListedItem(seller, 9505), 1005L);
        flushClear();

        String buyerBody = mockMvc.perform(
            get("/api/v1/orders/{id}", order.getPublicId()).with(user(String.valueOf(buyer.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.myRole").value("BUYER"))
            .andExpect(jsonPath("$.data.itemInstancePublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.settledAt").isNotEmpty())
            .andExpect(jsonPath("$.data.feeAmount").doesNotExist())
            .andExpect(jsonPath("$.data.settleAmount").doesNotExist())
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(buyerBody).doesNotContain("feeAmount").doesNotContain("settleAmount");

        mockMvc.perform(get("/api/v1/orders/{id}", order.getPublicId()).with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.myRole").value("SELLER"))
            .andExpect(jsonPath("$.data.feeAmount").value(FEE))
            .andExpect(jsonPath("$.data.settleAmount").value(SETTLE));
    }

    @Test
    void 없는_주문의_상세는_404_ORDER_001() throws Exception {
        User user = persistUser("ord_nf_user", "조회자", 0L);
        flushClear();

        mockMvc
            .perform(get("/api/v1/orders/{id}", "NONEXISTENTORDER0000000001").with(user(String.valueOf(user.getId()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ORDER_001"));
    }

    @Test
    void role_필터는_당사자_스코프_안에서_관점을_좁힌다() throws Exception {
        // me 가 한 주문에선 구매자, 다른 주문에선 판매자다. role=SELLER 면 판매분만 보여야 한다.
        User me = persistUser("ord_f_me", "양쪽", 0L);
        User other = persistUser("ord_f_other", "상대", 0L);
        persistOrder(me, other, persistListedItem(other, 9506), 1006L); // me=buyer
        persistOrder(other, me, persistListedItem(me, 9507), 1007L); // me=seller
        flushClear();

        mockMvc.perform(get("/api/v1/me/orders").param("role", "SELLER").with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].myRole").value("SELLER"));

        mockMvc.perform(get("/api/v1/me/orders").with(user(String.valueOf(me.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(2));
    }

    // ---------------- helpers ----------------

    private SaleOrder persistOrder(User buyer, User seller, ItemInstance item, long sourceId) {
        SaleOrder order = SaleOrder.builder()
            .sourceType(SaleOrderSourceType.AUCTION)
            .sourceId(sourceId)
            .buyer(buyer)
            .seller(seller)
            .itemInstance(item)
            .finalPrice(FINAL_PRICE)
            .feeAmount(FEE)
            .settleAmount(SETTLE)
            .feePolicyVersion("v1.0")
            .settledAt(Instant.now())
            .build();
        em.persist(order);
        return order;
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.INVENTORY).slotNo(null).build();
        em.persist(item);
        return item;
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("주문템플릿").build()));
    }

    private User persistUser(String loginId, String nickname, long gameMoney) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        UserBalance balance = UserBalance.builder().user(user).build();
        org.springframework.test.util.ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        em.persist(balance);
        return user;
    }

    private void flushClear() {
        em.flush();
        em.clear();
    }
}
