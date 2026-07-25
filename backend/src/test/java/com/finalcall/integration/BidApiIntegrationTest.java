package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.auction.entity.Auction;
import com.finalcall.domain.auction.entity.AuctionStatus;
import com.finalcall.domain.auction.repository.AuctionRepository;
import com.finalcall.domain.bid.BidStatus;
import com.finalcall.domain.currency.entity.MoneyHoldStatus;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.entity.UserBalance;
import com.finalcall.domain.member.repository.UserBalanceRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 입찰 API 통합 검증(bid, FC-032) — 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>계약 v1.8 §3.1·§5 와 bid-domain-spec §3(검증 순서)·§6(소프트클로즈)·§10(불변식)을 대상으로 한다.
 * <b>단언은 응답이 아니라 테이블 상태를 함께 본다</b> — 응답만 보면 "201 은 떴는데 홀드가 안 잡혔다" 같은
 * 구현 버그가 그대로 숨는다(§10 서문).
 *
 * <p>읽기·롤백이라 {@code @Transactional} 이며, 요청 전후로 {@code em.flush()/clear()} 해 요청이 DB 최신을
 * 읽게 하고 응답 후 검증도 1차 캐시가 아닌 DB 를 보게 한다.
 */
@Transactional
class BidApiIntegrationTest extends IntegrationTest {

    private static final long BALANCE = 1_000_000L;
    private static final long START_PRICE = 1_000L;

    @Autowired
    private EntityManager em;

    @Autowired
    private AuctionRepository auctionRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private UserBalanceRepository userBalanceRepository;

    // ---------------- 성립 경로 ----------------

    @Test
    void 첫_입찰은_201이고_최고가_갱신과_홀드를_남긴다() throws Exception {
        User seller = persistUser("bid_s1", "판매자1", 0L);
        User bidder = persistUser("bid_b1", "입찰자1", BALANCE);
        Auction auction = persistAuction(seller, 8101, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.bidPublicId").isNotEmpty())
            .andExpect(jsonPath("$.data.amount").value(START_PRICE))
            .andExpect(jsonPath("$.data.currentHighestAmount").value(START_PRICE))
            .andExpect(jsonPath("$.data.endAt").isNotEmpty());

        flushClear();
        Auction reloaded = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(reloaded.getHighestBidAmount()).isEqualTo(START_PRICE);
        assertThat(reloaded.getHighestBidder().getId()).isEqualTo(bidder.getId());

        // I1: 경매당 ACTIVE 입찰 1건이고 auction 최고가와 정확히 일치한다.
        assertThat(activeBidCount(auction)).isEqualTo(1);
        // I3·I4: 홀드가 원장에 HELD 로 남고 잔액이 정확히 그만큼 묶인다(차감이 아니라 잠금).
        assertThat(heldAmount(bidder)).isEqualTo(START_PRICE);
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isEqualTo(START_PRICE);
        assertThat(balanceOf(bidder).getGameMoneyBalance()).isEqualTo(BALANCE);
    }

    @Test
    void 상위_입찰은_직전_입찰을_OUTBID로_밀고_직전_홀드를_즉시_해제한다() throws Exception {
        User seller = persistUser("bid_s2", "판매자2", 0L);
        User first = persistUser("bid_b2a", "입찰자2A", BALANCE);
        User second = persistUser("bid_b2b", "입찰자2B", BALANCE);
        Auction auction = persistAuction(seller, 8102, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), first, START_PRICE))
            .andExpect(status().isCreated());
        flushClear();
        // 최고가 1,000 → 구간 증분 100 → 최소 다음 입찰 1,100.
        mockMvc.perform(bidRequest(auction.getPublicId(), second, START_PRICE + 100))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.currentHighestAmount").value(START_PRICE + 100));

        flushClear();
        // P-008 즉시 해제: 밀려난 입찰자의 자금은 마감을 기다리지 않고 풀린다.
        assertThat(balanceOf(first).getGameMoneyHeld()).isZero();
        assertThat(balanceOf(second).getGameMoneyHeld()).isEqualTo(START_PRICE + 100);
        // I3: HELD 홀드는 경매당 1건, 그 보유자가 현재 최고입찰자다.
        assertThat(heldAmount(first)).isZero();
        assertThat(heldAmount(second)).isEqualTo(START_PRICE + 100);
        assertThat(releasedCount(first)).isEqualTo(1);
        // I1: ACTIVE 입찰은 여전히 1건(직전 건은 OUTBID).
        assertThat(activeBidCount(auction)).isEqualTo(1);
        assertThat(bidStatusOf(auction, first)).isEqualTo(BidStatus.OUTBID);
        assertThat(bidStatusOf(auction, second)).isEqualTo(BidStatus.ACTIVE);
    }

    @Test
    void 개시시각이_지난_SCHEDULED_경매는_입찰과_동시에_ACTIVE로_승격된다() throws Exception {
        User seller = persistUser("bid_s3", "판매자3", 0L);
        User bidder = persistUser("bid_b3", "입찰자3", BALANCE);
        Auction auction = persistAuction(
            seller, 8103, AuctionStatus.SCHEDULED, hoursLater(-1), hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isCreated());

        flushClear();
        // 게이트2 d: 워커 없이 입찰 트랜잭션이 영속값을 자연 치유한다.
        assertThat(auctionRepository.findById(auction.getId()).orElseThrow().getStatus())
            .isEqualTo(AuctionStatus.ACTIVE);
    }

    // ---------------- 소프트클로즈(§6) ----------------

    @Test
    void 마감_직전_입찰은_마감을_연장하고_extension_count를_올린다() throws Exception {
        User seller = persistUser("bid_s4", "판매자4", 0L);
        User bidder = persistUser("bid_b4", "입찰자4", BALANCE);
        Instant endAt = Instant.now().plusSeconds(10); // 잔여 10초 < window 30초
        Auction auction = persistAuction(
            seller, 8104, AuctionStatus.ACTIVE, null, endAt, Instant.now().plus(1, ChronoUnit.HOURS));
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isCreated());

        flushClear();
        Auction reloaded = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(reloaded.getEndAt()).isAfter(endAt);
        assertThat(reloaded.getExtensionCount()).isEqualTo(1);
        // I7: 연장 결과는 상한을 넘지 않는다.
        assertThat(reloaded.getEndAt()).isBeforeOrEqualTo(reloaded.getMaxEndAt());
    }

    @Test
    void 상한에_도달했으면_연장없이_입찰만_성립한다() throws Exception {
        User seller = persistUser("bid_s5", "판매자5", 0L);
        User bidder = persistUser("bid_b5", "입찰자5", BALANCE);
        Instant endAt = Instant.now().plusSeconds(10);
        Auction auction = persistAuction(seller, 8105, AuctionStatus.ACTIVE, null, endAt, endAt); // max == end
        flushClear();

        // 연장 불가는 입찰 거부 사유가 아니다(게이트2 c — 대응 에러코드도 없다).
        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isCreated());

        flushClear();
        Auction reloaded = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(reloaded.getExtensionCount()).isZero();
        assertThat(reloaded.getHighestBidAmount()).isEqualTo(START_PRICE);
    }

    @Test
    void 윈도우_밖_입찰은_마감을_건드리지_않는다() throws Exception {
        User seller = persistUser("bid_s6", "판매자6", 0L);
        User bidder = persistUser("bid_b6", "입찰자6", BALANCE);
        Instant endAt = hoursLater(1);
        Auction auction = persistAuction(seller, 8106, AuctionStatus.ACTIVE, null, endAt, null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isCreated());

        flushClear();
        Auction reloaded = auctionRepository.findById(auction.getId()).orElseThrow();
        assertThat(reloaded.getEndAt()).isEqualTo(endAt);
        assertThat(reloaded.getExtensionCount()).isZero();
    }

    // ---------------- 거부 경로(계약 §5) ----------------

    @Test
    void 첫_입찰이_시작가에_미달하면_BID_001() throws Exception {
        User seller = persistUser("bid_s7", "판매자7", 0L);
        User bidder = persistUser("bid_b7", "입찰자7", BALANCE);
        Auction auction = persistAuction(seller, 8107, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE - 1))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_001"));

        flushClear();
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isZero();
    }

    @Test
    void 후속_입찰이_최소증분에_미달하면_BID_001() throws Exception {
        User seller = persistUser("bid_s8", "판매자8", 0L);
        User first = persistUser("bid_b8a", "입찰자8A", BALANCE);
        User second = persistUser("bid_b8b", "입찰자8B", BALANCE);
        Auction auction = persistAuction(seller, 8108, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), first, START_PRICE)).andExpect(status().isCreated());
        flushClear();
        // 최소 다음 입찰은 1,100 이므로 1,099 는 증분 미달이다.
        mockMvc.perform(bidRequest(auction.getPublicId(), second, START_PRICE + 99))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_001"));

        flushClear();
        // I6: 실패한 입찰은 어떤 흔적도 남기지 않는다 — 직전 홀드도 그대로다.
        assertThat(balanceOf(second).getGameMoneyHeld()).isZero();
        assertThat(balanceOf(first).getGameMoneyHeld()).isEqualTo(START_PRICE);
        assertThat(activeBidCount(auction)).isEqualTo(1);
    }

    @Test
    void 음수_입찰액은_형식검증에서_400으로_막힌다() throws Exception {
        User seller = persistUser("bid_s9", "판매자9", 0L);
        User bidder = persistUser("bid_b9", "입찰자9", BALANCE);
        Auction auction = persistAuction(seller, 8109, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        // 음수는 홀드 CAS 조건(가용 >= amount)을 자명하게 통과시켜 홀드를 되레 줄이는 경로였다.
        //   @Positive(400) → BID_001(422) → MoneyHoldService 부호 검증 → DB CHECK 로 4중 방어한다.
        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, -1_000L))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("COMMON_001"));

        flushClear();
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isZero();
        assertThat(balanceOf(bidder).getGameMoneyBalance()).isEqualTo(BALANCE);
    }

    @Test
    void 즉시구매가_이상은_BID_002() throws Exception {
        User seller = persistUser("bid_s10", "판매자10", 0L);
        User bidder = persistUser("bid_b10", "입찰자10", BALANCE);
        Auction auction = persistAuction(seller, 8110, AuctionStatus.ACTIVE, null, hoursLater(1), null, 50_000L);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, 50_000L))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_002"));
    }

    @Test
    void 자기_경매_입찰은_BID_003_403() throws Exception {
        User seller = persistUser("bid_s11", "판매자11", BALANCE);
        Auction auction = persistAuction(seller, 8111, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        // wash trade·shill bidding 차단(SEC-003). 판정은 락 스냅샷의 seller_id 로만 한다.
        mockMvc.perform(bidRequest(auction.getPublicId(), seller, START_PRICE))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("BID_003"));
    }

    @Test
    void 최고입찰자의_연속_입찰은_BID_004_409() throws Exception {
        User seller = persistUser("bid_s12", "판매자12", 0L);
        User bidder = persistUser("bid_b12", "입찰자12", BALANCE);
        Auction auction = persistAuction(seller, 8112, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE)).andExpect(status().isCreated());
        flushClear();
        // 자기 가격 인상 차단. 앵커는 auction.highest_bidder_id 다(§13-e).
        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE + 100))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("BID_004"));

        flushClear();
        // 홀드가 이중으로 잡히지 않았다(I3·I4).
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isEqualTo(START_PRICE);
        assertThat(activeBidCount(auction)).isEqualTo(1);
    }

    @Test
    void 가용_잔액을_넘는_입찰은_BID_005이고_흔적을_남기지_않는다() throws Exception {
        User seller = persistUser("bid_s13", "판매자13", 0L);
        User bidder = persistUser("bid_b13", "입찰자13", 5_000L);
        Auction auction = persistAuction(seller, 8113, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, 10_000L))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("BID_005"));

        flushClear();
        // 자금·최고가에 흔적이 없다.
        assertThat(heldAmount(bidder)).isZero();
        assertThat(balanceOf(bidder).getGameMoneyHeld()).isZero();
        assertThat(auctionRepository.findById(auction.getId()).orElseThrow().getHighestBidAmount()).isNull();
        // ※ "bid 행도 남지 않는다"(I6)는 여기서 단언할 수 없다. 이 테스트는 @Transactional 이라 요청이 테스트
        //   트랜잭션에 참여하므로, 실패한 요청은 rollback-only 표시만 남기고 이미 flush 된 bid INSERT 를
        //   실제로 되돌리지 않는다(프로덕션은 요청별 독립 트랜잭션이라 롤백된다). 이 harness 한계 때문에
        //   롤백 원자성 검증은 비-트랜잭션 테스트인 BidConcurrencyIntegrationTest 가 맡는다.
    }

    @Test
    void 마감시각이_지난_경매는_BID_006_409() throws Exception {
        User seller = persistUser("bid_s14", "판매자14", 0L);
        User bidder = persistUser("bid_b14", "입찰자14", BALANCE);
        // status 는 ACTIVE 로 고여 있지만 마감 판정은 시각 기준이라 정확히 거부된다(마감 워커 부재와 무관).
        Auction auction = persistAuction(seller, 8114, AuctionStatus.ACTIVE, null, hoursLater(-1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("BID_006"));
    }

    @Test
    void 취소된_경매는_BID_006_409() throws Exception {
        User seller = persistUser("bid_s15", "판매자15", 0L);
        User bidder = persistUser("bid_b15", "입찰자15", BALANCE);
        Auction auction = persistAuction(seller, 8115, AuctionStatus.CANCELLED, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("BID_006"));
    }

    @Test
    void 아직_시작되지_않은_경매는_BID_007_409() throws Exception {
        User seller = persistUser("bid_s16", "판매자16", 0L);
        User bidder = persistUser("bid_b16", "입찰자16", BALANCE);
        Auction auction = persistAuction(seller, 8116, AuctionStatus.SCHEDULED, hoursLater(1), hoursLater(2), null);
        flushClear();

        // "아직 시작 안 함"과 "이미 끝남"은 재시도 가능성이 정반대라 코드를 나눈다(F4).
        mockMvc.perform(bidRequest(auction.getPublicId(), bidder, START_PRICE))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("BID_007"));
    }

    @Test
    void 없는_경매에_입찰하면_AUCTION_004_404() throws Exception {
        User bidder = persistUser("bid_b17", "입찰자17", BALANCE);
        flushClear();

        mockMvc.perform(bidRequest("NONEXISTENTAUCTION00000001", bidder, START_PRICE))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("AUCTION_004"));
    }

    // ---------------- 인가(§9) ----------------

    @Test
    void 미인증_입찰은_401이다() throws Exception {
        User seller = persistUser("bid_s18", "판매자18", 0L);
        Auction auction = persistAuction(seller, 8118, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/bids", auction.getPublicId())
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"amount\":1000}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void 입찰_내역_조회_경로는_인증없이_통과한다() throws Exception {
        User seller = persistUser("bid_s19", "판매자19", 0L);
        Auction auction = persistAuction(seller, 8119, AuctionStatus.ACTIVE, null, hoursLater(1), null);
        flushClear();

        // GET /auctions/*/bids 는 2세그먼트라 기존 permitAll(/auctions/*) 에 걸리지 않아 별도 등재했다.
        //   FC-033 에서 조회 핸들러가 붙어 이제 200 이다. 같은 경로의 POST 는 위 테스트대로 401 을 유지한다
        //   — 화이트리스트가 HTTP 메서드 단위로 좁게 열렸다는 증거다.
        mockMvc.perform(get("/api/v1/auctions/{id}/bids", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content").isEmpty());
    }

    // ---------------- helpers ----------------

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder bidRequest(
        String auctionPublicId, User bidder, long amount) {
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

    private long activeBidCount(Auction auction) {
        return em.createQuery(
            "SELECT COUNT(b) FROM Bid b WHERE b.auction.id = :id AND b.status = :status", Long.class)
            .setParameter("id", auction.getId())
            .setParameter("status", BidStatus.ACTIVE)
            .getSingleResult();
    }

    private BidStatus bidStatusOf(Auction auction, User bidder) {
        return em.createQuery(
            "SELECT b.status FROM Bid b WHERE b.auction.id = :id AND b.bidder.id = :bidderId", BidStatus.class)
            .setParameter("id", auction.getId())
            .setParameter("bidderId", bidder.getId())
            .getSingleResult();
    }

    /** 사용자별 HELD 원장 합계 — I4(원장 합계 == user_balance.game_money_held) 검증용. */
    private long heldAmount(User user) {
        Long sum = em.createQuery(
            "SELECT COALESCE(SUM(h.amount), 0) FROM MoneyHold h WHERE h.user.id = :id AND h.status = :status",
            Long.class)
            .setParameter("id", user.getId())
            .setParameter("status", MoneyHoldStatus.HELD)
            .getSingleResult();
        return sum == null ? 0L : sum;
    }

    private long releasedCount(User user) {
        return em.createQuery(
            "SELECT COUNT(h) FROM MoneyHold h WHERE h.user.id = :id AND h.status = :status", Long.class)
            .setParameter("id", user.getId())
            .setParameter("status", MoneyHoldStatus.RELEASED)
            .getSingleResult();
    }

    private UserBalance balanceOf(User user) {
        return userBalanceRepository.findByUserId(user.getId()).orElseThrow();
    }

    private Auction persistAuction(
        User seller, int typeCode, AuctionStatus status, Instant startAt, Instant endAt, Instant maxEndAt) {
        return persistAuction(seller, typeCode, status, startAt, endAt, maxEndAt, null);
    }

    private Auction persistAuction(
        User seller, int typeCode, AuctionStatus status, Instant startAt, Instant endAt, Instant maxEndAt,
        Long buyNowPrice) {
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(persistListedItem(seller, typeCode))
            .startPrice(START_PRICE).buyNowPrice(buyNowPrice)
            .status(status).startAt(startAt).endAt(endAt)
            .maxEndAt(maxEndAt != null ? maxEndAt : endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("입찰템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
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

    /** type_code 는 UK 라 find-or-create. 축은 typeCode 자리값에서 파생해 복합 UK 도 유일하게 만든다(시드 규약). */
    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("입찰템플릿").build()));
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
