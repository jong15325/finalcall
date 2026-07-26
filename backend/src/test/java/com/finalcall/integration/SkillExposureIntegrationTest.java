package com.finalcall.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.finalcall.domain.item.entity.ItemInstance;
import com.finalcall.domain.item.entity.ItemLocation;
import com.finalcall.domain.item.entity.ItemTemplate;
import com.finalcall.domain.item.entity.SkillDefinition;
import com.finalcall.domain.item.repository.ItemInstanceRepository;
import com.finalcall.domain.item.repository.ItemTemplateRepository;
import com.finalcall.domain.member.entity.User;
import com.finalcall.domain.member.repository.UserRepository;
import com.finalcall.domain.shop.dto.ShopItemResponse;
import com.finalcall.domain.shop.entity.Shop;
import com.finalcall.domain.shop.repository.ShopRepository;
import com.finalcall.support.IntegrationTest;
import com.finalcall.support.LocalDemoDataService;
import com.finalcall.support.LocalDemoDataService.ListedSeed;

import jakarta.persistence.EntityManager;

/**
 * 스킬명 노출 + 대량 마켓 시드 통합 검증(FC-098, EPIC-MARKET-DATA) — 실제 MySQL(Testcontainers).
 *
 * <p>검증 대상: (1) 공통 item 블록의 {@code skill1Name}/{@code skill2Name} 조인 노출(계약 §3.3, shop·auction 대칭),
 * (2) 마법 카드 스킬1 부재 시 null 폴백(§6), (3) LISTED-direct 대량 시드의 발행 정합·페이징·결정성(§3). {@code @Transactional}
 * 롤백이라 커밋 오염이 없다(대량 시드도 테스트 tx 내에서만 존재). 스킬명·스킬코드 출처는 Flyway V16 마스터다.
 */
@Transactional
class SkillExposureIntegrationTest extends IntegrationTest {

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
    private ShopRepository shopRepository;

    @Autowired
    private LocalDemoDataService data;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // ---------------- 스킬명 조인 노출 ----------------

    @Test
    void 경매_상세는_스킬명을_코드에_부가해_노출한다() throws Exception {
        User seller = persistUser("skx_auc", "경매판매자");
        // 물의 검(무기) + skill1=119(공격데미지 4 증가) + skill2=202(트리플샷).
        ItemInstance item = persistInventoryItem(seller, 1113, 119, 202, 25);
        flushClear();

        Instant end = Instant.now().plus(1, ChronoUnit.HOURS);
        String body = auctionRegisterBody(item.getPublicId(), end);
        String auctionPublicId = objectMapper.readTree(
            mockMvc.perform(post("/api/v1/auctions").with(user(String.valueOf(seller.getId())))
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString())
            .path("data").path("auctionPublicId").asText();
        flushClear();

        mockMvc.perform(get("/api/v1/auctions/{id}", auctionPublicId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.item.skill1").value(119))
            .andExpect(jsonPath("$.data.item.skill2").value(202))
            .andExpect(jsonPath("$.data.item.skill1Name").value("공격데미지 4 증가"))
            .andExpect(jsonPath("$.data.item.skill2Name").value("트리플샷"));
    }

    @Test
    void 고정가_상세는_스킬명을_코드에_부가해_노출한다() throws Exception {
        User seller = persistUser("skx_shop", "고정가판매자");
        String shopPublicId = seedOneListing(seller.getId(), 1113, 159, 205, 30, 500_000L);
        flushClear();

        mockMvc.perform(get("/api/v1/shops/{id}", shopPublicId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.item.skill1").value(159))
            .andExpect(jsonPath("$.data.item.skill2").value(205))
            .andExpect(jsonPath("$.data.item.skill1Name").value("가속도 5 증가"))
            .andExpect(jsonPath("$.data.item.skill2Name").value("뎀반사 60"));
    }

    @Test
    void 마법카드는_스킬1_부재로_skill1Name이_null이다() {
        User seller = persistUser("skx_magic", "마법판매자");
        // 물의 일반 마법(sub_group 3) — 스킬1 없음, 스킬2=314(회복불가 5초).
        String shopPublicId = seedOneListing(seller.getId(), 1311, null, 314, 0, 300_000L);
        flushClear();

        Shop shop = shopRepository.findDetailByPublicId(shopPublicId).orElseThrow();
        ShopItemResponse view = ShopItemResponse.from(shop);

        assertThat(view.skill1()).isNull();
        assertThat(view.skill1Name()).isNull();
        assertThat(view.skill2()).isEqualTo(314);
        assertThat(view.skill2Name()).isEqualTo("회복불가 5초");
    }

    // ---------------- 대량 마켓 시드 ----------------

    @Test
    void 대량_LISTED시드는_인스턴스_shop_소유이력을_정합_발행하고_페이징된다() throws Exception {
        User seller = persistUser("skx_bulk", "대량판매자");
        List<ListedSeed> seeds = new ArrayList<>();
        int count = 12;
        for (int i = 0; i < count; i++) {
            // typeCode·스킬·가격을 흩뿌려 정렬·필터 다양성을 만든다(전부 mainCategory=1 아이템 카드).
            int typeCode = (i % 2 == 0) ? 1113 : 1223;
            Integer skill1 = 100 + (i % 90);
            long price = 50_000L + (long)i * 1_000_000L;
            seeds.add(new ListedSeed(seller.getId(), typeCode, 1 + (i % 9), skill1, 300 + i, 10 + i,
                null, price, Instant.now().plus(1 + i, ChronoUnit.DAYS)));
        }
        int inserted = data.bulkCreateListedShopItems(seeds, 1);
        flushClear();

        assertThat(inserted).isEqualTo(count);
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM shop WHERE public_id LIKE 'SEEDSHOP%'", Integer.class)).isEqualTo(count);
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM item_instance WHERE public_id LIKE 'SEEDLIST%' AND location = 'LISTED'",
            Integer.class)).isEqualTo(count);
        // 소유이력 SEED 1행/인스턴스.
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM item_ownership_history h JOIN item_instance ii ON ii.id = h.instance_id "
                + "WHERE ii.public_id LIKE 'SEEDLIST%' AND h.transfer_type = 'SEED'",
            Integer.class)).isEqualTo(count);

        // 페이징: 판매 중(ACTIVE) 아이템 카드 목록을 커서 페이지로 자른다.
        mockMvc.perform(get("/api/v1/shops").param("size", "5").param("mainCategory", "1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content.length()").value(5))
            .andExpect(jsonPath("$.data.hasNext").value(true))
            .andExpect(jsonPath("$.data.nextCursor").isNotEmpty());
    }

    @Test
    void 동일_startIndex_재삽입은_publicId가_충돌해_실패한다() {
        User seller = persistUser("skx_dup", "중복판매자");
        List<ListedSeed> seeds = List.of(
            new ListedSeed(seller.getId(), 1113, 3, 100, 202, 15, null, 100_000L,
                Instant.now().plus(3, ChronoUnit.DAYS)));
        data.bulkCreateListedShopItems(seeds, 1);
        flushClear();

        // 결정성 public_id(멱등의 기반) — 같은 startIndex 재삽입은 UK 충돌. 재부팅 시 재시드는 demo1 마커가 막는다.
        assertThatThrownBy(() -> data.bulkCreateListedShopItems(seeds, 1))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    // ---------------- helpers ----------------

    private void flushClear() {
        em.flush();
        em.clear();
    }

    /** LISTED-direct 리스팅 1건을 발행하고 shop public_id 를 돌려준다(startIndex 1). */
    private String seedOneListing(Long sellerId, int typeCode, Integer skill1, Integer skill2, int skillPercent,
        long price) {
        data.bulkCreateListedShopItems(List.of(new ListedSeed(sellerId, typeCode, 5, skill1, skill2, skillPercent,
            null, price, Instant.now().plus(7, ChronoUnit.DAYS))), 1);
        return "SEEDSHOP" + String.format("%018d", 1);
    }

    private String auctionRegisterBody(String itemInstancePublicId, Instant end) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("itemInstancePublicId", itemInstancePublicId);
        body.put("startPrice", 1000L);
        body.put("buyNowPrice", null);
        body.put("startAt", null);
        body.put("endAt", end);
        body.put("maxEndAt", end.plus(1, ChronoUnit.HOURS));
        return objectMapper.writeValueAsString(body);
    }

    private ItemInstance persistInventoryItem(User owner, int typeCode, Integer skill1Code, Integer skill2Code,
        int skillPercent) {
        return itemInstanceRepository.save(ItemInstance.builder()
            .template(template(typeCode)).owner(owner).level(5)
            .skill1(skill(skill1Code)).skill2(skill(skill2Code)).skillPercent(skillPercent)
            .location(ItemLocation.INVENTORY).slotNo(0).build());
    }

    private SkillDefinition skill(Integer code) {
        if (code == null) {
            return null;
        }
        return em.createQuery("SELECT s FROM SkillDefinition s WHERE s.skillCode = :c", SkillDefinition.class)
            .setParameter("c", code)
            .getSingleResult();
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.findByTypeCode(typeCode).orElseThrow();
    }

    private User persistUser(String loginId, String nickname) {
        return userRepository.save(User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build());
    }
}
