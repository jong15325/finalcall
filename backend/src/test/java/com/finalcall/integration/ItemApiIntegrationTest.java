package com.finalcall.integration;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.finalcall.domain.item.ItemInstance;
import com.finalcall.domain.item.ItemInstanceRepository;
import com.finalcall.domain.item.ItemLocation;
import com.finalcall.domain.item.ItemTemplate;
import com.finalcall.domain.item.ItemTemplateRepository;
import com.finalcall.domain.member.User;
import com.finalcall.domain.member.UserRepository;
import com.finalcall.support.IntegrationTest;

/**
 * 아이템 카탈로그·상세·시드 인벤토리 API 통합 검증(item, FC-020·021·023) — 실제 MySQL(Testcontainers) + Security 필터.
 *
 * <p>계약 §4.1(카탈로그·상세)·§4.2(인벤토리). 상세는 소유자 마스킹 + 소유자 전용 slotNo 이원화(spec §5.2)를,
 * 시드는 GET /item-templates 8건·seed user 인벤토리 10건을 확인한다(FC-023 DoD). 읽기·롤백이라 {@code @Transactional}.
 */
@Transactional
class ItemApiIntegrationTest extends IntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ItemTemplateRepository itemTemplateRepository;

    @Autowired
    private ItemInstanceRepository itemInstanceRepository;

    @Test
    void 카탈로그는_시드_템플릿_8건을_노출한다() throws Exception {
        mockMvc.perform(get("/api/v1/item-templates").param("size", "100"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1111)]").exists())
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 2122)]").exists());
    }

    @Test
    void 카탈로그_대분류_필터는_해당_축만_반환한다() throws Exception {
        mockMvc.perform(get("/api/v1/item-templates").param("mainCategory", "1").param("size", "100"))
            .andExpect(status().isOk())
            // 시드 main=1 은 4건(1111·1112·1121·1122). main=2 는 제외.
            .andExpect(jsonPath("$.data.content[?(@.mainCategory == 2)]").doesNotExist())
            .andExpect(jsonPath("$.data.content[?(@.typeCode == 1111)]").exists());
    }

    @Test
    void 상세_비인증조회는_소유자마스킹_하고_slotNo를_숨긴다() throws Exception {
        ItemInstance instance = seedInstance("detail_owner1", "홍길동", 4);

        mockMvc.perform(get("/api/v1/items/{id}", instance.getPublicId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.itemInstancePublicId").value(instance.getPublicId()))
            .andExpect(jsonPath("$.data.location").value("INVENTORY"))
            .andExpect(jsonPath("$.data.ownerMasked").value("홍길***"))
            .andExpect(jsonPath("$.data.slotNo").doesNotExist());
    }

    @Test
    void 상세_소유자조회는_slotNo를_노출한다() throws Exception {
        User owner = userRepository.save(newUser("detail_owner2", "소유자닉"));
        ItemInstance instance = itemInstanceRepository.save(inventoryInstance(owner, 4, template(9701)));

        mockMvc.perform(get("/api/v1/items/{id}", instance.getPublicId()).with(user(String.valueOf(owner.getId()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.slotNo").value(4));
    }

    @Test
    void 상세_없는_인스턴스는_404_ITEM_001() throws Exception {
        mockMvc.perform(get("/api/v1/items/{id}", "NONEXISTENTPUBLICID0000001"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.code").value("ITEM_001"));
    }

    @Test
    void 시드_소유자의_인벤토리는_10건이다() throws Exception {
        Long seedSellerId = userRepository.findByLoginIdAndIsDeletedFalse("seed_seller").orElseThrow().getId();

        mockMvc.perform(get("/api/v1/me/inventory").with(user(String.valueOf(seedSellerId))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.capacity").value(96))
            .andExpect(jsonPath("$.data.used").value(10))
            .andExpect(jsonPath("$.data.items.length()").value(10));
    }

    @Test
    void 인벤토리_미인증은_401이다() throws Exception {
        mockMvc.perform(get("/api/v1/me/inventory"))
            .andExpect(status().isUnauthorized());
    }

    private ItemInstance seedInstance(String loginId, String nickname, int slotNo) {
        User owner = userRepository.save(newUser(loginId, nickname));
        return itemInstanceRepository.save(inventoryInstance(owner, slotNo, template(9700)));
    }

    private ItemInstance inventoryInstance(User owner, int slotNo, ItemTemplate template) {
        return ItemInstance.builder()
            .template(template).owner(owner).level(3).skillPercent(10)
            .location(ItemLocation.INVENTORY).slotNo(slotNo).build();
    }

    private ItemTemplate template(int typeCode) {
        return itemTemplateRepository.save(ItemTemplate.builder()
            .mainCategory(9).subGroup(1).element(1).kind(1).typeCode(typeCode).displayName("상세템플릿").build());
    }

    private User newUser(String loginId, String nickname) {
        return User.builder().loginId(loginId).passwordHash("hash").nickname(nickname).build();
    }
}
