package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 입찰 내역 조회 + 경매 최고가 실값 대체 통합 검증(bid/auction, FC-033) — 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>대상은 계약 v1.9 §3.1(입찰 내역)·§3.3(`BidSummary`·`AuctionDetail`·`AuctionSummary`)과
 * auction-domain-spec §9-b(EPIC-AUCTION 이 null/0 으로 남긴 자리를 EPIC-BID 가 실값으로 자연 대체)다.
 *
 * <p><b>보안 단언을 응답 본문 원문으로도 확인한다</b> — jsonPath 로 "마스킹된 값이 맞다"만 보면 다른 필드에
 * 원문 닉네임이 새는 경우를 놓친다. 인증 불요 엔드포인트라 누설은 곧 회원 열거 표면이다(SEC-007).
 *
 * <p>다른 테스트와 템플릿(type_code 는 전역 UK 이며 테스트 간 정리되지 않는다)이 충돌하지 않도록
 * <b>78xx 대역</b>을 전용으로 쓴다.
 */
@Transactional
class BidHistoryApiIntegrationTest extends IntegrationTest {

    private static final long BALANCE = 1_000_000L;
    private static final long START_PRICE = 1_000L;

    @Autowired
    private EntityManager em;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    // ---------------- GET /auctions/{id}/bids (계약 §3.1) ----------------

    @Test
    void 입찰_내역은_인증없이_금액_내림차순으로_반환되고_입찰자는_마스킹된다() throws Exception {
        User seller = persistUser("hist_s1", "판매자H1", 0L);
        User alpha = persistUser("hist_b1a", "봉준호", BALANCE);
        User beta = persistUser("hist_b1b", "박찬욱", BALANCE);
        Auction auction = persistAuction(seller, 7801, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        placeBid(auction, alpha, START_PRICE);
        placeBid(auction, beta, START_PRICE + 100);
        placeBid(auction, alpha, START_PRICE + 200);
        flushClear();

        String body = mockMvc.perform(get("/api/v1/auctions/{id}/bids", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            // 금액 내림차순 = 최신순(금액이 단조 증가하므로, I2).
            .andExpect(jsonPath("$.data.content[0].amount").value(START_PRICE + 200))
            .andExpect(jsonPath("$.data.content[1].amount").value(START_PRICE + 100))
            .andExpect(jsonPath("$.data.content[2].amount").value(START_PRICE))
            // 경매당 ACTIVE 는 최대 1건이고 그것이 현재 최고 입찰이다(I1).
            .andExpect(jsonPath("$.data.content[0].status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.content[1].status").value("OUTBID"))
            .andExpect(jsonPath("$.data.content[2].status").value("OUTBID"))
            // 마스킹 규약: 앞 2자 + *** (상세의 highestBidderMasked 와 동일).
            .andExpect(jsonPath("$.data.content[0].bidderMasked").value("봉준***"))
            .andExpect(jsonPath("$.data.content[1].bidderMasked").value("박찬***"))
            .andExpect(jsonPath("$.data.content[0].bidPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.content[0].createdAt").isNotEmpty())
            // offset 페이지 규약(계약 §1.3).
            .andExpect(jsonPath("$.data.page").value(0))
            .andExpect(jsonPath("$.data.size").value(20))
            .andExpect(jsonPath("$.data.totalElements").value(3))
            .andExpect(jsonPath("$.data.totalPages").value(1))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        // ★ 누설 방지: 원문 닉네임·loginId 가 어떤 필드로도 새어 나가지 않는다(SEC-007).
        assertThat(body).doesNotContain("봉준호").doesNotContain("박찬욱")
            .doesNotContain("hist_b1a").doesNotContain("hist_b1b");
        // 자금 정보(홀드·잔액)는 응답 스키마에 아예 없다.
        assertThat(body).doesNotContain("hold").doesNotContain("balance");
    }

    @Test
    void 입찰_내역은_offset_페이지네이션된다() throws Exception {
        User seller = persistUser("hist_s2", "판매자H2", 0L);
        User alpha = persistUser("hist_b2a", "입찰자2A", BALANCE);
        User beta = persistUser("hist_b2b", "입찰자2B", BALANCE);
        Auction auction = persistAuction(seller, 7802, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        placeBid(auction, alpha, START_PRICE);
        placeBid(auction, beta, START_PRICE + 100);
        placeBid(auction, alpha, START_PRICE + 200);
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}/bids", auction.getPublicId()).param("page", "0").param("size", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(2))
            .andExpect(jsonPath("$.data.content[0].amount").value(START_PRICE + 200))
            .andExpect(jsonPath("$.data.totalElements").value(3))
            .andExpect(jsonPath("$.data.totalPages").value(2));

        mockMvc.perform(get("/api/v1/auctions/{id}/bids", auction.getPublicId()).param("page", "1").param("size", "2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].amount").value(START_PRICE))
            .andExpect(jsonPath("$.data.page").value(1));
    }

    @Test
    void 입찰_내역_page_size는_서버가_경계로_접는다() throws Exception {
        User seller = persistUser("hist_s3", "판매자H3", 0L);
        Auction auction = persistAuction(seller, 7803, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        // 음수 page 는 PageRequest 가 예외를 던져 500 이 되고, 무제한 size 는 미인증 요청 하나로 전 이력을 뽑게 한다.
        mockMvc.perform(get("/api/v1/auctions/{id}/bids", auction.getPublicId())
            .param("page", "-5").param("size", "100000"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.page").value(0))
            .andExpect(jsonPath("$.data.size").value(100));
    }

    @Test
    void 없는_경매의_입찰_내역은_AUCTION_004_404() throws Exception {
        // 빈 페이지를 주면 "입찰 0건"과 "잘못된 링크"를 구분할 수 없다.
        mockMvc.perform(get("/api/v1/auctions/{id}/bids", "NONEXISTENTAUCTION00000002"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("AUCTION_004"));
    }

    // ---------------- auction 최고가 실값 대체(spec §9-b) ----------------

    @Test
    void 상세는_입찰_후_최고가_입찰수_최고입찰자를_실값으로_노출한다() throws Exception {
        User seller = persistUser("hist_s4", "판매자H4", 0L);
        User alpha = persistUser("hist_b4a", "최민식", BALANCE);
        User beta = persistUser("hist_b4b", "송강호", BALANCE);
        Auction auction = persistAuction(seller, 7804, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        placeBid(auction, alpha, START_PRICE);
        placeBid(auction, beta, START_PRICE + 100);
        flushClear();

        String body = mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.highestBidAmount").value(START_PRICE + 100))
            // 입찰 수는 이력 전체(OUTBID 포함)다.
            .andExpect(jsonPath("$.data.bidCount").value(2))
            .andExpect(jsonPath("$.data.highestBidderMasked").value("송강***"))
            // 최고가 1,100 → 구간(~9,999) 증분 100 → 다음 최소 입찰가 1,200.
            .andExpect(jsonPath("$.data.minNextBidAmount").value(START_PRICE + 200))
            .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(body).doesNotContain("송강호").doesNotContain("최민식");
    }

    @Test
    void 목록은_입찰_후_최고가와_입찰수를_실값으로_노출한다() throws Exception {
        User seller = persistUser("hist_s5", "판매자H5", 0L);
        User bidder = persistUser("hist_b5", "입찰자5", BALANCE);
        Auction auction = persistAuction(seller, 7815, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        placeBid(auction, bidder, START_PRICE);
        flushClear();

        // mainCategory 7 은 이 테스트 전용 대역이라 다른 테스트 데이터가 섞이지 않는다.
        mockMvc.perform(get("/api/v1/auctions").param("mainCategory", "7").param("subGroup", "8")
            .param("kind", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].auctionPublicId").value(auction.getPublicId()))
            .andExpect(jsonPath("$.data.content[0].highestBidAmount").value(START_PRICE))
            .andExpect(jsonPath("$.data.content[0].bidCount").value(1));
    }

    @Test
    void 입찰이_없으면_최고가는_null이고_minNextBidAmount는_시작가다() throws Exception {
        User seller = persistUser("hist_s6", "판매자H6", 0L);
        Auction auction = persistAuction(seller, 7806, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        // 첫 입찰의 하한은 증분이 아니라 시작가다(계약 v1.8 F5).
        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.highestBidAmount").doesNotExist())
            .andExpect(jsonPath("$.data.bidCount").value(0))
            .andExpect(jsonPath("$.data.highestBidderMasked").doesNotExist())
            .andExpect(jsonPath("$.data.minNextBidAmount").value(START_PRICE));
    }

    @Test
    void 종료된_경매의_minNextBidAmount는_null이다() throws Exception {
        User seller = persistUser("hist_s7", "판매자H7", 0L);
        Auction auction = persistAuction(seller, 7807, AuctionStatus.CANCELLED, hoursLater(1));
        flushClear();

        // 더 이상 입찰이 성립하지 않는데 금액을 안내하면 클라이언트가 실패할 입찰 UI 를 연다(계약 v1.9 §3.3).
        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"))
            .andExpect(jsonPath("$.data.minNextBidAmount").doesNotExist());
    }

    /**
     * 상세의 {@code minNextBidAmount} 는 입찰 검증({@code BID_001})과 <b>같은 규칙</b>이어야 한다 — 안내 금액으로
     * 입찰했는데 거부되면 그 자체가 계약 위반이다. 구간 경계(10,000 → 증분 1,000)에서 두 경로를 맞물려 확인한다.
     */
    @Test
    void 상세가_안내한_minNextBidAmount로_입찰하면_정확히_성립한다() throws Exception {
        User seller = persistUser("hist_s8", "판매자H8", 0L);
        User alpha = persistUser("hist_b8a", "입찰자8A", BALANCE);
        User beta = persistUser("hist_b8b", "입찰자8B", BALANCE);
        Auction auction = persistAuction(seller, 7808, AuctionStatus.ACTIVE, hoursLater(1));
        flushClear();

        placeBid(auction, alpha, 10_000L); // 구간 경계: 10,000 이상은 증분 1,000
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(jsonPath("$.data.minNextBidAmount").value(11_000L));
        flushClear();

        // 안내값 미만은 거부되고, 안내값은 성립한다 — 두 판정이 같은 코드에서 나온다는 증거다.
        mockMvc.perform(bidRequest(auction.getPublicId(), beta, 10_999L))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_001"));
        flushClear();
        mockMvc.perform(bidRequest(auction.getPublicId(), beta, 11_000L))
            .andExpect(status().isCreated());
    }

    // ---------------- helpers ----------------

    private void placeBid(Auction auction, User bidder, long amount) throws Exception {
        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, amount)).andExpect(status().isCreated());
        flushClear();
    }

    private MockHttpServletRequestBuilder bidRequest(String auctionPublicId, User bidder, long amount) {
        return post("/api/v1/auctions/{id}/bids", auctionPublicId)
            .with(user(String.valueOf(bidder.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"amount\":" + amount + "}");
    }

    private void flushClear() {
        em.flush();
        em.clear();
    }

    private Instant hoursLater(int hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
    }

    private Auction persistAuction(User seller, int typeCode, AuctionStatus status, Instant endAt) {
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(persistListedItem(seller, typeCode))
            .startPrice(START_PRICE)
            .status(status).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("내역템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        em.persist(auction);
        return auction;
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
        ItemInstance item = ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build();
        em.persist(item);
        return item;
    }

    /** type_code 는 전역 UK 라 find-or-create. 축은 자리값에서 파생해 복합 UK 도 유일하게 만든다(시드 규약). */
    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("내역템플릿").build()));
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
