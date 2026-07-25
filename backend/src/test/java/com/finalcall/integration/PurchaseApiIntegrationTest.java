package com.finalcall.integration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 즉시구매 API 통합 검증(purchase, FC-089) — 실제 MySQL(Testcontainers) + Security 필터. 계약 §3.1 즉시구매
 * 엔드포인트의 성공 응답 형태(201 {@code { orderPublicId, finalPrice }})와 에러 HTTP 매핑을 고정한다.
 *
 * <p>서비스 계층 불변식·동시성은 {@code PurchaseSettlementIntegrationTest}·{@code PurchaseConcurrencyIntegrationTest}
 * 가 실제 커밋으로 검증한다. 여기서는 컨트롤러 배선·인증·에러코드 HTTP status 만 본다(@Transactional 롤백). <b>94xx 대역</b>.
 */
@Transactional
class PurchaseApiIntegrationTest extends IntegrationTest {

    private static final long BALANCE = 100_000_000L;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Test
    void 즉시구매_성공은_201과_orderPublicId_finalPrice를_반환한다() throws Exception {
        User seller = persistUser("pa_ok_seller", "판매", 0L);
        User buyer = persistUser("pa_ok_buyer", "구매", BALANCE);
        Auction auction = persistBuyNowAuction(seller, 9401, 100_000L, 1_000_000L);
        flushClear();

        mockMvcPurchase(auction, buyer)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.orderPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.finalPrice").value(1_000_000L));
    }

    @Test
    void 즉시구매가가_없으면_422_AUCTION_005() throws Exception {
        User seller = persistUser("pa_ns_seller", "판매", 0L);
        User buyer = persistUser("pa_ns_buyer", "구매", BALANCE);
        Auction auction = persistBuyNowAuction(seller, 9402, 100_000L, null);
        flushClear();

        mockMvcPurchase(auction, buyer)
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("AUCTION_005"));
    }

    @Test
    void 판매자_자기구매는_403_AUCTION_009() throws Exception {
        User seller = persistUser("pa_self_seller", "판매", BALANCE);
        Auction auction = persistBuyNowAuction(seller, 9403, 100_000L, 1_000_000L);
        flushClear();

        mockMvcPurchase(auction, seller)
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("AUCTION_009"));
    }

    @Test
    void 가용잔액_부족은_422_BID_005() throws Exception {
        User seller = persistUser("pa_poor_seller", "판매", 0L);
        User buyer = persistUser("pa_poor_buyer", "구매", 100_000L);
        Auction auction = persistBuyNowAuction(seller, 9404, 100_000L, 1_000_000L);
        flushClear();

        mockMvcPurchase(auction, buyer)
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_005"));
    }

    @Test
    void 없는_경매_즉시구매는_404_AUCTION_004() throws Exception {
        User buyer = persistUser("pa_nf_buyer", "구매", BALANCE);
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/purchase", "NONEXISTENTAUCTION00000009")
            .with(user(String.valueOf(buyer.getId()))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("AUCTION_004"));
    }

    @Test
    void 인증없는_즉시구매는_401이다() throws Exception {
        User seller = persistUser("pa_anon_seller", "판매", 0L);
        Auction auction = persistBuyNowAuction(seller, 9405, 100_000L, 1_000_000L);
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/purchase", auction.getPublicId()))
            .andExpect(status().isUnauthorized());
    }

    // ---------------- helpers ----------------

    private org.springframework.test.web.servlet.ResultActions mockMvcPurchase(Auction auction, User buyer)
        throws Exception {
        return mockMvc.perform(post("/api/v1/auctions/{id}/purchase", auction.getPublicId())
            .with(user(String.valueOf(buyer.getId()))));
    }

    private Auction persistBuyNowAuction(User seller, int typeCode, long startPrice, Long buyNowPrice) {
        Instant endAt = Instant.now().plus(1, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(seller).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(item).startPrice(startPrice).buyNowPrice(buyNowPrice)
            .status(AuctionStatus.ACTIVE).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(1).softCloseExtendSec(1)
            .itemNameSnapshot("구매API템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(auction);
        return auction;
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("구매API템플릿").build()));
    }

    private User persistUser(String loginId, String nickname, long gameMoney) {
        User user = User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
        em.persist(user);
        UserBalance balance = UserBalance.builder().user(user).build();
        ReflectionTestUtils.setField(balance, "gameMoneyBalance", gameMoney);
        em.persist(balance);
        return user;
    }

    private void flushClear() {
        em.flush();
        em.clear();
    }
}
