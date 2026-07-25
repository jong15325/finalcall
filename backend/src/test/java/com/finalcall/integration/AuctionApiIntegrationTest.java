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
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.auction.Auction;
import com.finalcall.domain.auction.AuctionRepository;
import com.finalcall.domain.auction.AuctionStatus;
import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.item.TempStorageRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 경매 등록·목록·상세·취소 API 통합 검증(auction, FC-026·027·028) — 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>계약 §3.1·§3.3·§5. 등록 CAS·에스크로 전이·lazy 활성화 파생·주체 인가(IDOR)를 확인한다. 읽기·롤백이라
 * {@code @Transactional} 이며, 설정 엔티티 mutation 후 {@code em.flush()/clear()}로 요청이 DB 최신을 읽게 한다
 * (프로덕션 요청별 독립 트랜잭션과 동일 거동 — 공유 tx L1 캐시 staleness 회피).
 */
@Transactional
class AuctionApiIntegrationTest extends IntegrationTest {

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager em;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Autowired
    private AuctionRepository auctionRepository;

    @Autowired
    private TempStorageRepository tempStorageRepository;

    // ---------------- 등록(FC-026) ----------------

    @Test
    void 등록_startAt_없으면_ACTIVE_생성하고_item을_LISTED로_전이한다() throws Exception {
        User seller = persistUser("auc_reg1", "등록판매자1");
        ItemInstance item = persistInventoryItem(seller, 0, 9301);
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, null, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.auctionPublicId").isNotEmpty());

        flushClear();
        ItemInstance reloaded = itemInstanceRepository.findById(item.getId()).orElseThrow();
        assertThat(reloaded.getLocation()).isEqualTo(ItemLocation.LISTED);
        assertThat(reloaded.getSlotNo()).isNull();
    }

    @Test
    void 등록_startAt_미래면_SCHEDULED_생성한다() throws Exception {
        User seller = persistUser("auc_reg2", "등록판매자2");
        ItemInstance item = persistInventoryItem(seller, 0, 9302);
        flushClear();

        Instant start = Instant.now().plus(30, ChronoUnit.MINUTES);
        Instant end = Instant.now().plus(2, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, null, start, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.status").value("SCHEDULED"));
    }

    @Test
    void 등록_buyNow가_startPrice_이하면_AUCTION_003() throws Exception {
        User seller = persistUser("auc_reg3", "등록판매자3");
        ItemInstance item = persistInventoryItem(seller, 0, 9303);
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, 1000L, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("AUCTION_003"));
    }

    @Test
    void 등록_endAt이_과거면_AUCTION_008() throws Exception {
        User seller = persistUser("auc_reg4", "등록판매자4");
        ItemInstance item = persistInventoryItem(seller, 0, 9304);
        flushClear();

        Instant pastEnd = Instant.now().minus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                registerBody(item.getPublicId(), 1000L, null, null, pastEnd, Instant.now().plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("AUCTION_008"));
    }

    @Test
    void 등록_타인_아이템이면_AUCTION_001_403() throws Exception {
        User owner = persistUser("auc_owner5", "실소유자5");
        User attacker = persistUser("auc_atk5", "타인5");
        ItemInstance item = persistInventoryItem(owner, 0, 9305);
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(attacker.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, null, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("AUCTION_001"));
    }

    @Test
    void 등록_이미_출품중_아이템이면_AUCTION_002_409() throws Exception {
        User seller = persistUser("auc_reg6", "등록판매자6");
        ItemInstance item = persistListedItem(seller, 9306); // 이미 LISTED
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, null, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AUCTION_002"));
    }

    @Test
    void 등록_TEMP_아이템은_미보유_AUCTION_001_403() throws Exception {
        User seller = persistUser("auc_reg7", "등록판매자7");
        ItemInstance item = persistTempItem(seller, 9307);
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
            .contentType(MediaType.APPLICATION_JSON)
            .content(registerBody(item.getPublicId(), 1000L, null, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("AUCTION_001"));
    }

    @Test
    void 등록_미인증은_401() throws Exception {
        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/v1/auctions")
            .contentType(MediaType.APPLICATION_JSON)
            .content(
                registerBody("ANYPUBLICID0000000000000001", 1000L, null, null, end, end.plus(1, ChronoUnit.HOURS))))
            .andExpect(status().isUnauthorized());
    }

    // ---------------- 상세·목록(FC-027) ----------------

    @Test
    void 상세는_경매와_item스냅샷을_노출하고_인증없이_조회된다() throws Exception {
        User seller = persistUser("auc_det1", "상세판매자1");
        Auction auction = persistAuction(seller, 9311, AuctionStatus.ACTIVE, null, hoursLater(1));
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("ACTIVE"))
            .andExpect(jsonPath("$.data.sellerNickname").value("상세판매자1"))
            .andExpect(jsonPath("$.data.item.typeCode").value(9311))
            .andExpect(jsonPath("$.data.item.nameSnapshot").value("경매템플릿"))
            // 입찰이 없는 경매라 최고가 계열은 여전히 null/0 이다(EPIC-BID 이후에도 "입찰 없음"의 정직한 표현).
            .andExpect(jsonPath("$.data.highestBidAmount").doesNotExist())
            .andExpect(jsonPath("$.data.bidCount").value(0))
            .andExpect(jsonPath("$.data.highestBidderMasked").doesNotExist())
            .andExpect(jsonPath("$.data.extensionCount").value(0))
            // FC-033: 첫 입찰의 하한은 시작가다(계약 v1.8 F3·F5).
            .andExpect(jsonPath("$.data.minNextBidAmount").value(1000));
    }

    @Test
    void 상세_SCHEDULED이고_startAt이_지났으면_ACTIVE로_파생노출() throws Exception {
        User seller = persistUser("auc_det2", "상세판매자2");
        // 영속값 SCHEDULED + startAt 과거 → 조회 시 lazy 파생 ACTIVE(게이트2 a).
        Auction auction = persistAuction(seller, 9312, AuctionStatus.SCHEDULED, hoursLater(-1), hoursLater(1));
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    void 상세_SCHEDULED이고_startAt이_미래면_SCHEDULED_유지() throws Exception {
        User seller = persistUser("auc_det3", "상세판매자3");
        Auction auction = persistAuction(seller, 9313, AuctionStatus.SCHEDULED, hoursLater(1), hoursLater(2));
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}", auction.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("SCHEDULED"));
    }

    @Test
    void 상세_없는_경매는_AUCTION_004_404() throws Exception {
        mockMvc.perform(get("/api/v1/auctions/{id}", "NONEXISTENTAUCTION00000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("AUCTION_004"));
    }

    @Test
    void 목록은_기본노출_진행가능_경매만_cursor로_반환한다() throws Exception {
        User seller = persistUser("auc_list1", "목록판매자1");
        persistAuction(seller, 9321, AuctionStatus.ACTIVE, null, hoursLater(1));
        persistAuction(seller, 9322, AuctionStatus.ACTIVE, null, hoursLater(2));
        flushClear();

        mockMvc.perform(get("/api/v1/auctions").param("size", "1")
            .param("mainCategory", "9"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());
    }

    @Test
    void 목록_status필터로_취소분을_조회할_수_있다() throws Exception {
        User seller = persistUser("auc_list2", "목록판매자2");
        Auction cancelled = persistAuction(seller, 9331, AuctionStatus.CANCELLED, null, hoursLater(1));
        persistAuction(seller, 9332, AuctionStatus.ACTIVE, null, hoursLater(1));
        flushClear();

        mockMvc.perform(get("/api/v1/auctions").param("status", "CANCELLED").param("mainCategory", "9"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(1))
            .andExpect(jsonPath("$.data.content[0].auctionPublicId").value(cancelled.getPublicId()));
    }

    // ---------------- 취소(FC-028) ----------------

    @Test
    void 취소는_ACTIVE를_CANCELLED로_전이하고_item을_인벤토리로_복귀한다() throws Exception {
        User seller = persistUser("auc_can1", "취소판매자1");
        Auction auction = persistAuction(seller, 9341, AuctionStatus.ACTIVE, null, hoursLater(1));
        Long itemId = auction.getItemInstance().getId();
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        flushClear();
        ItemInstance reloaded = itemInstanceRepository.findById(itemId).orElseThrow();
        assertThat(reloaded.getLocation()).isEqualTo(ItemLocation.INVENTORY);
        assertThat(reloaded.getSlotNo()).isNotNull();
        assertThat(auctionStatus(auction.getId())).isEqualTo(AuctionStatus.CANCELLED);
    }

    @Test
    void 취소는_SCHEDULED도_전이한다() throws Exception {
        User seller = persistUser("auc_can2", "취소판매자2");
        Auction auction = persistAuction(seller, 9342, AuctionStatus.SCHEDULED, hoursLater(1), hoursLater(2));
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));
    }

    @Test
    void 취소_타인은_AUCTION_001_403() throws Exception {
        User seller = persistUser("auc_can3", "취소판매자3");
        User attacker = persistUser("auc_atk3", "타인취소3");
        Auction auction = persistAuction(seller, 9343, AuctionStatus.ACTIVE, null, hoursLater(1));
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(attacker.getId()))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("AUCTION_001"));
    }

    @Test
    void 취소_이미_종료된_경매는_AUCTION_006_409() throws Exception {
        User seller = persistUser("auc_can4", "취소판매자4");
        Auction auction = persistAuction(seller, 9344, AuctionStatus.CANCELLED, null, hoursLater(1));
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AUCTION_006"));
    }

    @Test
    void 취소_입찰이_있으면_AUCTION_007_409() throws Exception {
        User seller = persistUser("auc_can5", "취소판매자5");
        User bidder = persistUser("auc_bid5", "입찰자5");
        Auction auction = persistAuction(seller, 9345, AuctionStatus.ACTIVE, null, hoursLater(1));
        // 입찰 미구현이라 highest_bidder_id 를 직접 세팅해 "입찰 존재" 앵커를 만든다(게이트2 e).
        em.createNativeQuery("UPDATE auction SET highest_bidder_id = :bidderId WHERE id = :id")
            .setParameter("bidderId", bidder.getId())
            .setParameter("id", auction.getId())
            .executeUpdate();
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("AUCTION_007"));
    }

    @Test
    void 취소_인벤토리_만실이면_item을_TEMP로_보관한다() throws Exception {
        User seller = persistUser("auc_can6", "취소판매자6");
        // 정규 인벤토리 96칸을 가득 채운다(slot 0~95).
        for (int slot = 0; slot < 96; slot++) {
            persistInventoryItem(seller, slot, 9350);
        }
        Auction auction = persistAuction(seller, 9351, AuctionStatus.ACTIVE, null, hoursLater(1));
        Long itemId = auction.getItemInstance().getId();
        flushClear();

        mockMvc.perform(post("/api/v1/auctions/{id}/cancel", auction.getPublicId())
            .with(user(String.valueOf(seller.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        flushClear();
        ItemInstance reloaded = itemInstanceRepository.findById(itemId).orElseThrow();
        assertThat(reloaded.getLocation()).isEqualTo(ItemLocation.TEMP);
        assertThat(reloaded.getSlotNo()).isNull();
        assertThat(tempStorageRepository.findByInstanceId(itemId)).isPresent();
    }

    // ---------------- helpers ----------------

    private void flushClear() {
        em.flush();
        em.clear();
    }

    private Instant hoursLater(int hours) {
        return Instant.now().plus(hours, ChronoUnit.HOURS).truncatedTo(ChronoUnit.MILLIS);
    }

    private String registerBody(
        String itemInstancePublicId, Long startPrice, Long buyNowPrice, Instant startAt, Instant endAt,
        Instant maxEndAt) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("itemInstancePublicId", itemInstancePublicId);
        body.put("startPrice", startPrice);
        body.put("buyNowPrice", buyNowPrice);
        body.put("startAt", startAt);
        body.put("endAt", endAt);
        body.put("maxEndAt", maxEndAt);
        return objectMapper.writeValueAsString(body);
    }

    private AuctionStatus auctionStatus(Long auctionId) {
        return em.createQuery("SELECT a.status FROM Auction a WHERE a.id = :id", AuctionStatus.class)
            .setParameter("id", auctionId)
            .getSingleResult();
    }

    private Auction persistAuction(User seller, int typeCode, AuctionStatus status, Instant startAt, Instant endAt) {
        ItemInstance item = persistListedItem(seller, typeCode);
        Auction auction = Auction.builder()
            .seller(seller).itemInstance(item).startPrice(1000L)
            .status(status).startAt(startAt).endAt(endAt).maxEndAt(endAt.plus(1, ChronoUnit.HOURS))
            .softCloseWindowSec(30).softCloseExtendSec(30)
            .itemNameSnapshot("경매템플릿").itemSpecSnapshot("Lv.1 / skill1=-/skill2=- / 0% / GF=-")
            .build();
        return auctionRepository.save(auction);
    }

    private ItemInstance persistInventoryItem(User owner, int slotNo, int typeCode) {
        return itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.INVENTORY).slotNo(slotNo).build());
    }

    private ItemInstance persistListedItem(User owner, int typeCode) {
        return itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.LISTED).slotNo(null).build());
    }

    private ItemInstance persistTempItem(User owner, int typeCode) {
        return itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(1).skillPercent(0)
            .location(ItemLocation.TEMP).slotNo(null).build());
    }

    /**
     * type_code 는 UK 라 find-or-create 로 재사용한다(같은 typeCode 를 여러 인스턴스가 공유). 축(main/sub/element/kind)은
     * typeCode 자리값에서 파생해 {@code (main,sub,element,kind)} 복합 UK 도 유일하게 만든다(시드 규약 동일).
     */
    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode)
            .orElseGet(() -> itemTemplateRepository.save(ItemTemplate.builder()
                .mainCategory(typeCode / 1000).subGroup(typeCode / 100 % 10)
                .element(typeCode / 10 % 10).kind(typeCode % 10)
                .typeCode(typeCode).displayName("경매템플릿").build()));
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }
}
